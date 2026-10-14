import { assetfareActionProvider } from "./assetfareActionProvider";
import { AssetFareDirectRouteSummarySchema, GetQuoteSchema } from "./schemas";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonical(object[key])}`)
    .join(",")}}`;
};
const sha256 = (value: unknown) =>
  createHash("sha256").update(canonical(value), "utf8").digest("hex");
const QUOTE_PAYLOAD_SHA256_SPEC =
  "sha256(AssetFare typed-canonical-v1 bytes of the quote without continuation_v3 after exact base-unit substitution: n=null; t/f=boolean; d=<IEEE-754 binary64 big-endian 16 lowercase hex> for each finite JSON number; s=<UTF-8 byte length>:<Unicode scalar text with lone surrogates forbidden>; a=<count>:[items]; o=<count>:{UTF-8-byte-sorted string-key/value pairs}; every non-substituted integral JSON number must be within +/-9007199254740991; substituted paths are intent.estimated_input_base, route.input_base, route.expected_output_base, route.minimum_output_base, and every route.steps[i].expected_input_base/floor_input_base/expected_output_base/minimum_output_base from direct_route_summary exact decimal strings)";

const decimalString = (value: number): string => {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match) throw new Error("invalid fixture number");
  const negative = match[1] === "-";
  const whole = match[2];
  const fraction = match[3] || "";
  const exponent = Number(match[4] || 0);
  let digits = whole + fraction;
  let point = whole.length + exponent;
  if (point <= 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }
  if (point >= digits.length) digits += "0".repeat(point - digits.length);
  let rendered =
    point === 0
      ? `0.${digits}`
      : point === digits.length
        ? digits
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  if (rendered.includes(".")) rendered = rendered.replace(/0+$/, "").replace(/\.$/, "");
  rendered = rendered.replace(/^0+(?=\d)/, "") || "0";
  if (rendered.startsWith(".")) rendered = `0${rendered}`;
  if (/^0(?:\.0*)?$/.test(rendered)) return "0";
  return negative ? `-${rendered}` : rendered;
};

const hasLoneSurrogate = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
};

const typedCanonical = (value: unknown): Buffer => {
  if (value === null) return Buffer.from("n", "ascii");
  if (value === true) return Buffer.from("t", "ascii");
  if (value === false) return Buffer.from("f", "ascii");
  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      (Number.isInteger(value) && Math.abs(value) > Number.MAX_SAFE_INTEGER)
    )
      throw new Error("unsafe number");
    const bytes = Buffer.allocUnsafe(8);
    bytes.writeDoubleBE(value);
    return Buffer.from(`d${bytes.toString("hex")}`, "ascii");
  }
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) throw new Error("invalid unicode");
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([Buffer.from(`s${bytes.length}:`, "ascii"), bytes]);
  }
  if (Array.isArray(value))
    return Buffer.concat([
      Buffer.from(`a${value.length}:[`, "ascii"),
      ...value.map(typedCanonical),
      Buffer.from("]", "ascii"),
    ]);
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
  return Buffer.concat([
    Buffer.from(`o${entries.length}:{`, "ascii"),
    ...entries.flatMap(([key, item]) => [typedCanonical(key), typedCanonical(item)]),
    Buffer.from("}", "ascii"),
  ]);
};

const quotePayloadProjection = (value: Record<string, unknown>) => {
  const payload = structuredClone(value);
  delete payload.continuation_v3;
  const intent = payload.intent as Record<string, unknown>;
  const route = payload.route as Record<string, unknown>;
  const summary = payload.direct_route_summary as Record<string, unknown>;
  const steps = summary.steps as Array<Record<string, unknown>>;
  const rawSteps = route.steps as Array<Record<string, unknown>>;
  intent.estimated_input_base = steps[0].expected_input_base;
  route.input_base = steps[0].expected_input_base;
  route.minimum_output_base = steps[steps.length - 1].minimum_output_base;
  route.expected_output_base = steps[steps.length - 1].expected_output_base;
  rawSteps.forEach((raw, index) => {
    const exact = steps[index];
    raw.expected_input_base = exact.expected_input_base;
    raw.floor_input_base = exact.minimum_input_base;
    raw.expected_output_base = exact.expected_output_base;
    raw.minimum_output_base = exact.minimum_output_base;
  });
  return payload;
};

const quotePayloadSha256 = (value: Record<string, unknown>) =>
  createHash("sha256")
    .update(typedCanonical(quotePayloadProjection(value)))
    .digest("hex");

describe("AssetFareActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = assetfareActionProvider();

  const capabilities = {
    chains: [
      "arbitrum",
      "base",
      "ethereum",
      "hyperevm",
      "optimism",
      "polygon",
      "robinhood",
      "solana",
    ],
    asset_endpoints: [{ chain: "solana", token: "USDC" }],
    source_only_asset_endpoints: [
      { chain: "polygon", token: "USDC" },
      { chain: "optimism", token: "USDC" },
      { chain: "ethereum", token: "USDC" },
      { chain: "hyperevm", token: "USDC" },
    ],
    execution_implemented_routes: 80,
    currently_prepare_ready_routes: 80,
    temporarily_unavailable_routes: [],
    execution_availability: { status: "available", guarantees_future_availability: false },
    server_signing: false,
    server_submission: false,
    direct_route_summary: {
      version: "assetfare-direct-route-summary-v1",
      required_on_every_quote: true,
      route_count: 80,
      step_count: 188,
      ordered_provider_path: true,
      normalized_chain_asset_endpoints: true,
      base_unit_amounts_are_decimal_strings: true,
      assetfare_fee_step_bound: true,
      classification_values: ["direct_protocol_only", "external_intent"],
      route_aggregator_used_scope: "assetfare_engine_only",
      external_intent:
        "No public route uses an external intent protocol; provider-internal liquidity sourcing or aggregation remains possible",
      server_signing: false,
      server_submission: false,
    },
  };

  const directRouteSummary = {
    version: "assetfare-direct-route-summary-v1",
    route: "solana:USDC->base:USDC",
    from: "solana:USDC",
    to: "base:USDC",
    classification: "direct_protocol_only",
    mode: "cctp_direct_composition",
    route_aggregator_used: false,
    external_intent_protocol_used: false,
    provider_internal_dex_aggregation_possible: false,
    assetfare_fee_bps: 1,
    fee_collection_step_index: 0,
    server_signing: false,
    server_submission: false,
    step_count: 1,
    steps: [
      {
        index: 0,
        action: "bridge",
        provider: "circle_cctp",
        from: "solana:USDC",
        to: "base:USDC",
        expected_input_base: "250000000",
        minimum_input_base: "250000000",
        expected_output_base: "249895639",
        minimum_output_base: "249895318",
        assetfare_fee_bps: 1,
        direct_protocol: true,
        external_intent_protocol: false,
        aggregator_api_used: false,
      },
    ],
  };

  const quote = {
    quote_id: "00000000-0000-4000-8000-000000000001",
    as_of: "2026-01-01T00:00:00Z",
    ttl_seconds: 60,
    intent: {
      from: "solana:USDC",
      to: "base:USDC",
      amount_usd: 250,
      estimated_input_base: 250000000,
    },
    offer: {
      expected_receive_usd: 249.895639,
      estimated_min_receive_usd: 249.895318,
      assetfare_fee_bps: 1,
      fee_collection_steps: [0],
    },
    cost_summary: {
      scope: "token_path_only_network_gas_excluded",
      input_value_usd: 250,
      expected_total_cost_usd: 0.104361,
      expected_total_cost_percent: 0.0417,
      assetfare_service_fee: { bps: 1, estimated_usd: 0.025 },
      unpriced_costs: ["source_chain_network_fee"],
      rankable_all_in: false,
    },
    eta: { estimated_time_range_seconds: [8, 20] },
    route: {
      route: "solana:USDC->base:USDC",
      mode: "cctp_direct_composition",
      input_base: 250000000,
      expected_output_base: 249895639,
      minimum_output_base: 249895318,
      steps: [
        {
          index: 0,
          kind: "direct_bridge",
          provider: "circle_cctp",
          route_fee_bps: 1,
          expected_input_base: 250000000,
          floor_input_base: 250000000,
          expected_output_base: 249895639,
          minimum_output_base: 249895318,
        },
      ],
      aggregator_api_used: false,
      external_intent_protocol_used: false,
      server_signing: false,
      server_submission: false,
    },
    direct_route_summary: directRouteSummary,
    risk: {
      non_atomic: true,
      external_intent_protocol_used: false,
      provider_internal_dex_aggregation_possible: false,
      server_signing: false,
      server_submission: false,
    },
    execution: { supported: true, current_prepare_readiness: "available" },
    economic_guidance: {
      advisory_start_usd: 250,
      advisory_role: "observed_economic_zone_start",
      status: "observed_competitive_or_near_parity",
      confidence: "measured_route_specific",
      basis: "dated route-specific measurements",
      tested_amounts_usd: [50, 250, 1000],
      not_an_execution_minimum: true,
      not_a_best_price_guarantee: true,
      fresh_quote_required: true,
    },
  };

  const addContinuation = (input: Record<string, unknown>) => {
    delete input.continuation_v3;
    const value = input as typeof quote;
    const summary = value.direct_route_summary;
    const wallets = [
      ...new Set(
        summary.steps.flatMap(step => [step.from.split(":", 1)[0], step.to.split(":", 1)[0]]),
      ),
    ].sort();
    const signer = summary.steps.some(
      step => step.provider === "circle_cctp" && step.from.startsWith("solana:"),
    );
    const modes = summary.step_count > 1 ? ["session"] : ["one_shot", "session"];
    const bounds = {
      minimum: value.direct_route_summary.steps[0].expected_input_base,
      maximum: value.direct_route_summary.steps[0].expected_input_base,
    };
    const summaryHash = sha256(summary);
    const payloadHash = quotePayloadSha256(value);
    const issued = new Date();
    const expires = new Date(issued.getTime() + 60_000);
    const claim = {
      version: "assetfare-quote-bound-continuation-v3",
      quote_id: value.quote_id,
      issued_at: issued.toISOString(),
      expires_at: expires.toISOString(),
      ttl_seconds: "60",
      intent: {
        from: value.intent.from,
        to: value.intent.to,
        amount_usd_decimal: decimalString(value.intent.amount_usd),
        estimated_input_base: bounds.minimum,
      },
      direct_route_summary_sha256: summaryHash,
      quote_payload_sha256: payloadHash,
      quote_payload_sha256_spec: QUOTE_PAYLOAD_SHA256_SPEC,
      input_base_bounds: bounds,
      minimum_output_base:
        value.direct_route_summary.steps[value.direct_route_summary.steps.length - 1]
          .minimum_output_base,
      required_wallet_chains: wallets,
      event_signer_public_required: signer,
      step_count: String(summary.step_count),
      allowed_modes: modes,
      server_signing: false,
      server_submission: false,
    };
    input.continuation_v3 = {
      version: "assetfare-quote-bound-continuation-v3",
      enforcement: "server_enforced_quote_binding",
      selection_status: "unranked_candidate",
      automatic_selection_forbidden: true,
      caller_approved_boolean_is_not_human_proof: true,
      quote_id: value.quote_id,
      quote_fingerprint: sha256(claim),
      quote_fingerprint_spec:
        "sha256(UTF-8 sorted-key compact JSON of quote_fingerprint_claim; every numeric claim is a non-exponent decimal string)",
      quote_fingerprint_claim: claim,
      issued_at: claim.issued_at,
      expires_at: claim.expires_at,
      ttl_seconds: 60,
      intent: structuredClone(value.intent),
      direct_route_summary_sha256: summaryHash,
      quote_payload_sha256: payloadHash,
      quote_payload_sha256_spec: QUOTE_PAYLOAD_SHA256_SPEC,
      input_base_bounds: bounds,
      minimum_output_base: claim.minimum_output_base,
      required_wallet_chains: wallets,
      event_signer_public_required: signer,
      step_count: summary.step_count,
      recommended_mode: summary.step_count > 1 ? "session" : "one_shot_or_session",
      allowed_modes: modes,
      session_header: {
        name: "X-AssetFare-Session-Token",
        required_for: "session",
        caller_generated: true,
        minimum_entropy_bits: 256,
        server_returns_raw_value: false,
      },
      idempotency: {
        required: true,
        field: "idempotency_key",
        pattern: "^[A-Za-z0-9._:-]{8,128}$",
        scope: "quote_and_selected_mode",
      },
      approval_v3_required_fields: [
        "direct_route_summary_sha256",
        "idempotency_key",
        "maximum_input_base",
        "minimum_output_base",
        "quote_fingerprint",
        "quote_id",
        "selected_mode",
        "selection_status",
        "version",
      ],
      legacy_handoff_enforcement: "legacy_advisory",
      server_signing: false,
      server_submission: false,
    };
    return value;
  };

  const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
  const continuationOf = (value: Record<string, unknown>): Record<string, unknown> =>
    asRecord(value.continuation_v3);

  addContinuation(quote);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("getCapabilities", () => {
    it("should return the live route surface when the API call succeeds", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => capabilities });

      const result = await provider.getCapabilities({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.implementedRoutes).toEqual(80);
      expect(parsed.currentlyPrepareReadyRoutes).toEqual(80);
      expect(parsed.serverSigning).toBe(false);
      expect(parsed.serverSubmission).toBe(false);
      expect(parsed.directRouteSummary).toMatchObject({
        version: "assetfare-direct-route-summary-v1",
        required_on_every_quote: true,
        route_count: 80,
        ordered_provider_path: true,
      });
      expect(parsed.evaluationGuidance).toMatchObject({
        schemaVersion: 3,
        routeMinimumUsd: 1,
        reachabilitySmokeUsd: 1,
        reachabilitySmokeOnly: true,
        bestFromField: "economic_guidance.advisory_start_usd",
        useAssetFareFirstAtOrAboveBestFrom: true,
        bestFromNot100PercentGuarantee: true,
        confirmFreshAssetFareQuote: true,
        executionSelectionSeparate: true,
        automaticSelectionForbidden: true,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.assetfare.dev/v2/capabilities",
        expect.objectContaining({
          headers: expect.objectContaining({ accept: "application/json" }),
        }),
      );
    });

    it("should fail closed when the service does not report a no-sign boundary", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ...capabilities, server_signing: true }),
      });

      const result = await provider.getCapabilities({});

      expect(result).toContain("no-sign, no-submit boundary");
    });

    it("should fail closed when the mandatory summary contract is missing or incomplete", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ...capabilities, direct_route_summary: undefined }),
      });

      const result = await provider.getCapabilities({});

      expect(result).toContain("mandatory direct_route_summary contract");
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      const result = await provider.getCapabilities({});

      expect(result).toContain("Error reading AssetFare capabilities");
      expect(result).toContain("HTTP 503");
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.getCapabilities({});

      expect(result).toContain("Error reading AssetFare capabilities");
      expect(result).toContain("Network error");
    });
  });

  describe("getQuote", () => {
    const args = {
      fromChain: "solana" as const,
      fromToken: "USDC" as const,
      toChain: "base" as const,
      toToken: "USDC" as const,
      amountUsd: 250,
    };

    it("should reject unsupported token/chain and source-only directions before network work", () => {
      expect(
        GetQuoteSchema.safeParse({ ...args, fromChain: "base", fromToken: "SOL" }).success,
      ).toBe(false);
      expect(GetQuoteSchema.safeParse({ ...args, amountUsd: 1000.01 }).success).toBe(true);
      expect(GetQuoteSchema.safeParse({ ...args, amountUsd: 1_000_000 }).success).toBe(true);
      expect(
        GetQuoteSchema.safeParse({ ...args, amountUsd: Number.POSITIVE_INFINITY }).success,
      ).toBe(false);
      expect(
        GetQuoteSchema.safeParse({
          ...args,
          fromChain: "optimism",
          fromToken: "USDC",
          toChain: "base",
          toToken: "USDC",
        }).success,
      ).toBe(true);
      expect(
        GetQuoteSchema.safeParse({
          ...args,
          fromChain: "ethereum",
          fromToken: "USDC",
          toChain: "solana",
          toToken: "USDC",
        }).success,
      ).toBe(true);
      expect(
        GetQuoteSchema.safeParse({
          ...args,
          fromChain: "base",
          fromToken: "USDC",
          toChain: "polygon",
          toToken: "USDC",
        }).success,
      ).toBe(false);
    });

    it("should return the quote with its full cost summary", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => quote });

      const result = await provider.getQuote(args);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.quoteId).toEqual(quote.quote_id);
      expect(parsed.costSummary.expected_total_cost_usd).toEqual(0.104361);
      expect(parsed.costSummary.rankable_all_in).toBe(false);
      expect(parsed.ttlSeconds).toEqual(60);
      expect(parsed.directRouteSummary).toEqual(directRouteSummary);
      expect(parsed.directRouteSummary.steps[0]).toMatchObject({
        provider: "circle_cctp",
        from: "solana:USDC",
        to: "base:USDC",
        assetfare_fee_bps: 1,
      });
      expect(parsed.agentGuidance.evaluationGuidance).toMatchObject({
        schemaVersion: 3,
        routeMinimumUsd: 1,
        reachabilitySmokeOnly: true,
        bestFromField: "economic_guidance.advisory_start_usd",
        useAssetFareFirstAtOrAboveBestFrom: true,
        bestFromNot100PercentGuarantee: true,
        confirmFreshAssetFareQuote: true,
        executionSelectionSeparate: true,
        automaticSelectionForbidden: true,
      });
      expect(parsed.economicGuidance.advisory_start_usd).toBe(250);
      expect(parsed.agentGuidance.bestFromUsd).toBe(250);
      expect(parsed.agentGuidance.useAssetFareFirstAtOrAboveBestFrom).toBe(true);
      expect(parsed.agentGuidance.bestFromNot100PercentGuarantee).toBe(true);
      expect(parsed.agentGuidance.confirmFreshAssetFareQuote).toBe(true);
      expect(parsed.agentGuidance.compareWithOtherRoutes).toBe(false);
      expect(parsed.agentGuidance.selectionStatus).toBe("unranked_candidate");
      expect(parsed.agentGuidance.transactionSigned).toBe(false);
      expect(parsed.agentGuidance.transactionSubmitted).toBe(false);
      expect(parsed.agentGuidance.continuationV3Verified).toBe(true);
      expect(parsed.agentGuidance.automaticSelectionForbidden).toBe(true);
      expect(parsed.agentGuidance.approvalV3Generated).toBe(false);
      expect(parsed.agentGuidance.walletCollectionPerformed).toBe(false);
      expect(parsed.agentGuidance.prepareCalls).toBe(0);
      expect(parsed.agentGuidance.sessionCalls).toBe(0);
      expect(parsed.agentGuidance.callerOwnedContinuation).toMatchObject({
        packageVersion: "1.13.2",
        requiresFreshRequote: true,
        requiresExplicitCallerApprovalBeforePlan: true,
        providerReturnsRawQuote: false,
        providerRemainsReadOnly: true,
        outcome: "verified_unsigned_plan_only",
        walletSignsAndSubmits: true,
        assetFareServerSignsOrSubmits: false,
      });
      expect(parsed.agentGuidance.callerOwnedContinuation.quoteCommand.args).toEqual([
        "--yes",
        "--package=assetfare-mcp@1.13.2",
        "assetfare-route-eval",
        "--amount",
        "250",
        "--from-chain",
        "solana",
        "--from-token",
        "USDC",
        "--to-chain",
        "base",
        "--to-token",
        "USDC",
        "--quote-output",
        "quote.json",
      ]);
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("--select-exact-quote-bounds");
      expect(parsed.agentGuidance.callerOwnedContinuation.actionLifetime).toEqual({
        quoteTtlSeconds: 60,
        actionBundleTtlSeconds: 180,
        evmOnchainDeadlineSeconds: 240,
        walletReadyMinimumRemainingSeconds: 120,
      });
      expect(
        parsed.agentGuidance.callerOwnedContinuation.walletReadyCommandTemplate.args,
      ).toContain("wallet-ready");
      expect(
        parsed.agentGuidance.callerOwnedContinuation.callerOwnedRunnerCommandTemplate.args,
      ).toContain("assetfare-agent-runner");
      expect(parsed.agentGuidance.callerOwnedContinuation.callerOwnedRunner).toEqual({
        policySchema: "https://assetfare.dev/schemas/caller-owned-execution-policy-v2.json",
        keyLocation: "caller_wallet_adapter_only",
        remoteMcpExecutionTool: false,
        assetFareServerKeyAccess: false,
        assetFareServerSignsOrSubmits: false,
      });
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("solana=<CALLER_SOLANA_PUBLIC_ADDRESS>");
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("base=<CALLER_BASE_PUBLIC_ADDRESS>");
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("<CALLER_EPHEMERAL_SOLANA_PUBLIC_KEY>");
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("--wallet-handoff-output");
      expect(
        parsed.agentGuidance.callerOwnedContinuation.unsignedPlanCommandTemplate.args,
      ).toContain("./caller-wallet-handoff.json");
      expect(JSON.stringify(parsed.agentGuidance.callerOwnedContinuation)).not.toMatch(
        /private_key|seed_phrase|signed_transaction|session_token/i,
      );
      expect(parsed.continuationDescriptor).toMatchObject({
        version: "assetfare-quote-bound-continuation-v3",
        selection_status: "unranked_candidate",
        required_wallet_chains: ["base", "solana"],
        event_signer_public_required: true,
        allowed_modes: ["one_shot", "session"],
        recommended_mode: "one_shot_or_session",
        openapi_url: "https://api.assetfare.dev/v2/openapi",
        legacy_handoff_enforcement: "legacy_advisory",
        approval_v3_generated: false,
      });
      expect(parsed.continuationDescriptor.quote_fingerprint_claim).toBeUndefined();
      expect(parsed.continuationDescriptor.input_base_bounds).toBeUndefined();
    });

    it("should fail closed on malformed, tampered, or auto-selected continuation_v3", async () => {
      const mutators = [
        (value: Record<string, unknown>) => {
          delete value.continuation_v3;
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).extra = true;
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).selection_status = "selected";
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).automatic_selection_forbidden = false;
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).caller_approved_boolean_is_not_human_proof = false;
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).quote_fingerprint = "0".repeat(64);
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).quote_payload_sha256_spec = "forbidden";
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).required_wallet_chains = ["base"];
        },
        (value: Record<string, unknown>) => {
          continuationOf(value).allowed_modes = ["session"];
        },
        (value: Record<string, unknown>) => {
          asRecord(continuationOf(value).input_base_bounds).maximum = "250000001";
        },
        (value: Record<string, unknown>) => {
          asRecord(continuationOf(value).session_header).server_returns_raw_value = true;
        },
        (value: Record<string, unknown>) => {
          asRecord(continuationOf(value).quote_fingerprint_claim).step_count = "2";
        },
        (value: Record<string, unknown>) => {
          asRecord(continuationOf(value).quote_fingerprint_claim).quote_payload_sha256_spec =
            "forbidden";
        },
      ];
      for (const mutate of mutators) {
        const hostile = structuredClone(quote);
        mutate(hostile);
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => hostile });
        const result = await provider.getQuote(args);
        expect(result).toContain("intent-bound direct_route_summary");
      }
    });

    it("should accept the portable payload hash for integral USD and raw base units above 2^53", async () => {
      const portableQuote = structuredClone(quote);
      const exactInput = "9007199254740993";
      const exactOutput = "9007199254740893";
      const exactMinimum = "9007199254740793";
      portableQuote.intent.amount_usd = 1000;
      portableQuote.intent.estimated_input_base = Number(exactInput);
      (portableQuote.route as Record<string, unknown>).input_base = Number(exactInput);
      (portableQuote.route as Record<string, unknown>).expected_output_base = Number(exactOutput);
      portableQuote.route.minimum_output_base = Number(exactMinimum);
      const raw = portableQuote.route.steps[0] as Record<string, unknown>;
      raw.expected_input_base = Number(exactInput);
      raw.floor_input_base = Number(exactInput);
      raw.expected_output_base = Number(exactOutput);
      raw.minimum_output_base = Number(exactMinimum);
      Object.assign(portableQuote.direct_route_summary.steps[0], {
        expected_input_base: exactInput,
        minimum_input_base: exactInput,
        expected_output_base: exactOutput,
        minimum_output_base: exactMinimum,
      });
      addContinuation(portableQuote);
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => portableQuote });
      const rawResult = await provider.getQuote({ ...args, amountUsd: 1000 });
      expect(rawResult).not.toContain("Error requesting AssetFare quote");
      const result = JSON.parse(rawResult);
      expect(result.success).toBe(true);
      expect(result.continuationDescriptor.quote_fingerprint).toBe(
        asRecord(asRecord(portableQuote).continuation_v3).quote_fingerprint,
      );
    });

    it("should preserve JSON types and negative zero and reject unsafe evidence integers", () => {
      const numeric = structuredClone(quote);
      const string = structuredClone(quote);
      const negativeZero = structuredClone(quote);
      const positiveZero = structuredClone(quote);
      (numeric.route.steps[0] as Record<string, unknown>).semantic = 1;
      (string.route.steps[0] as Record<string, unknown>).semantic = "1";
      (negativeZero.route.steps[0] as Record<string, unknown>).semantic = -0;
      (positiveZero.route.steps[0] as Record<string, unknown>).semantic = 0;
      expect(quotePayloadSha256(numeric)).not.toBe(quotePayloadSha256(string));
      expect(quotePayloadSha256(negativeZero)).not.toBe(quotePayloadSha256(positiveZero));
      const unsafe = structuredClone(quote);
      (unsafe.route.steps[0] as Record<string, unknown>).semantic = 500000000000000000;
      expect(() => quotePayloadSha256(unsafe)).toThrow("unsafe number");
      const invalidUnicode = structuredClone(quote);
      (invalidUnicode.route.steps[0] as Record<string, unknown>).semantic = "\ud800";
      expect(() => quotePayloadSha256(invalidUnicode)).toThrow("invalid unicode");
    });

    it("should preserve the Core 2.4.1 typed-canonical fixture but reject its pre-guidance quote", async () => {
      const fixtureText = readFileSync(
        join(__dirname, "fixtures", "core-241-unsafe-integer-quote.json"),
        "utf8",
      );
      expect(fixtureText).toContain('"amount_usd":1000.0');
      expect(fixtureText).toContain('"estimated_input_base":9007199254740993');
      const fixture = JSON.parse(fixtureText) as Record<string, unknown>;
      const fixtureIntent = asRecord(fixture.intent);
      const fixtureSummary = asRecord(fixture.direct_route_summary);
      const fixtureSummarySteps = fixtureSummary.steps as Array<Record<string, unknown>>;
      expect(fixtureIntent.estimated_input_base).toBe(9007199254740992);
      expect(fixtureSummarySteps[0].expected_input_base).toBe("9007199254740993");
      expect(quotePayloadSha256(fixture)).toBe(
        "f071dead7a91a993e72ec086ac7948e801880bf24cda916ad0761e962249f17c",
      );
      const now = jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-24T14:08:00Z"));
      try {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => fixture });
        const result = await provider.getQuote({
          fromChain: "base",
          fromToken: "USDC",
          toChain: "arbitrum",
          toToken: "USDC",
          amountUsd: 1000,
        });
        expect(result).toContain("quote did not report a valid non-custodial");
      } finally {
        now.mockRestore();
      }
    });

    it("should post the route intent in the API's snake_case shape", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => quote });

      await provider.getQuote(args);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toEqual("https://api.assetfare.dev/v2/quote");
      expect(init.method).toEqual("POST");
      expect(JSON.parse(init.body)).toEqual({
        from_chain: "solana",
        from_token: "USDC",
        to_chain: "base",
        to_token: "USDC",
        amount_usd: 250,
      });
    });

    it("should fail closed when the quote does not report a no-submit boundary", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ...quote, risk: { ...quote.risk, server_submission: true } }),
      });

      const result = await provider.getQuote(args);

      expect(result).toContain("intent-bound direct_route_summary");
    });

    it("should fail closed when direct_route_summary is missing", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ...quote, direct_route_summary: undefined }),
      });

      const result = await provider.getQuote(args);

      expect(result).toContain("intent-bound direct_route_summary");
    });

    it("should fail closed when direct_route_summary is not bound to the requested intent", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...quote,
          direct_route_summary: {
            ...directRouteSummary,
            from: "solana:SOL",
            route: "solana:SOL->base:USDC",
            steps: [
              {
                ...directRouteSummary.steps[0],
                from: "solana:SOL",
              },
            ],
          },
        }),
      });

      const result = await provider.getQuote(args);

      expect(result).toContain("intent-bound direct_route_summary");
    });

    it("should fail closed on summary extras, fee mismatches, and raw-provider mismatches", async () => {
      const hostileQuotes = [
        {
          ...quote,
          direct_route_summary: { ...directRouteSummary, private_key: "forbidden" },
        },
        {
          ...quote,
          direct_route_summary: { ...directRouteSummary, fee_collection_step_index: 1 },
        },
        {
          ...quote,
          route: {
            ...quote.route,
            steps: [{ ...quote.route.steps[0], provider: "across_intent_bridge" }],
          },
        },
      ];

      for (const hostileQuote of hostileQuotes) {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => hostileQuote });
        const result = await provider.getQuote(args);
        expect(result).toContain("intent-bound direct_route_summary");
      }
    });

    it("should require the Across caveat exactly when an external-intent step is present", () => {
      const externalSummary = {
        ...directRouteSummary,
        route: "base:USDC->robinhood:USDG",
        from: "base:USDC",
        to: "robinhood:USDG",
        classification: "external_intent",
        mode: "robinhood_across_ingress_composition",
        external_intent_protocol_used: true,
        provider_internal_dex_aggregation_possible: true,
        steps: [
          {
            ...directRouteSummary.steps[0],
            provider: "across_intent_bridge",
            from: "base:USDC",
            to: "robinhood:USDG",
            direct_protocol: false,
            external_intent_protocol: true,
          },
        ],
      };

      expect(AssetFareDirectRouteSummarySchema.safeParse(externalSummary).success).toBe(true);
      expect(
        AssetFareDirectRouteSummarySchema.safeParse({
          ...externalSummary,
          provider_internal_dex_aggregation_possible: false,
        }).success,
      ).toBe(false);
    });

    it("should surface API error messages", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "route_not_supported" }),
      });

      const result = await provider.getQuote(args);

      expect(result).toContain("Error requesting AssetFare quote");
      expect(result).toContain("route_not_supported");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
