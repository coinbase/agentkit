import { createHash } from "node:crypto";
import { z } from "zod";
import { AssetFareDirectRouteSummarySchema } from "./schemas";

const VERSION = "assetfare-quote-bound-continuation-v3";
const QUOTE_PAYLOAD_SHA256_SPEC =
  "sha256(AssetFare typed-canonical-v1 bytes of the quote without continuation_v3 after exact base-unit substitution: n=null; t/f=boolean; d=<IEEE-754 binary64 big-endian 16 lowercase hex> for each finite JSON number; s=<UTF-8 byte length>:<Unicode scalar text with lone surrogates forbidden>; a=<count>:[items]; o=<count>:{UTF-8-byte-sorted string-key/value pairs}; every non-substituted integral JSON number must be within +/-9007199254740991; substituted paths are intent.estimated_input_base, route.input_base, route.expected_output_base, route.minimum_output_base, and every route.steps[i].expected_input_base/floor_input_base/expected_output_base/minimum_output_base from direct_route_summary exact decimal strings)";
const HASH = /^[0-9a-f]{64}$/;
const POSITIVE = /^[1-9][0-9]*$/;
const CHAINS = ["arbitrum", "base", "optimism", "polygon", "robinhood", "solana"] as const;
const APPROVAL_FIELDS = [
  "direct_route_summary_sha256",
  "idempotency_key",
  "maximum_input_base",
  "minimum_output_base",
  "quote_fingerprint",
  "quote_id",
  "selected_mode",
  "selection_status",
  "version",
] as const;
const fingerprintSpec =
  "sha256(UTF-8 sorted-key compact JSON of quote_fingerprint_claim; every numeric claim is a non-exponent decimal string)";
const hash = z.string().regex(HASH);
const positive = z.string().regex(POSITIVE);
const chain = z.enum(CHAINS);

const claimSchema = z
  .object({
    version: z.literal(VERSION),
    quote_id: z.string().uuid(),
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
    ttl_seconds: positive,
    intent: z
      .object({
        from: z.string(),
        to: z.string(),
        amount_usd_decimal: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        estimated_input_base: positive,
      })
      .strict(),
    direct_route_summary_sha256: hash,
    quote_payload_sha256: hash,
    quote_payload_sha256_spec: z.literal(QUOTE_PAYLOAD_SHA256_SPEC),
    input_base_bounds: z.object({ minimum: positive, maximum: positive }).strict(),
    minimum_output_base: positive,
    required_wallet_chains: z.array(chain).min(1).max(6),
    event_signer_public_required: z.boolean(),
    step_count: positive,
    allowed_modes: z
      .array(z.enum(["one_shot", "session"]))
      .min(1)
      .max(2),
    server_signing: z.literal(false),
    server_submission: z.literal(false),
  })
  .strict();

const continuationSchema = z
  .object({
    version: z.literal(VERSION),
    enforcement: z.literal("server_enforced_quote_binding"),
    selection_status: z.literal("unranked_candidate"),
    automatic_selection_forbidden: z.literal(true),
    caller_approved_boolean_is_not_human_proof: z.literal(true),
    quote_id: z.string().uuid(),
    quote_fingerprint: hash,
    quote_fingerprint_spec: z.literal(fingerprintSpec),
    quote_fingerprint_claim: claimSchema,
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
    ttl_seconds: z.number().int().min(1).max(60),
    intent: z
      .object({
        from: z.string(),
        to: z.string(),
        amount_usd: z.number().finite(),
        estimated_input_base: z
          .number()
          .finite()
          .positive()
          .refine(Number.isInteger, { message: "estimated input base must be an integer" }),
      })
      .passthrough(),
    direct_route_summary_sha256: hash,
    quote_payload_sha256: hash,
    quote_payload_sha256_spec: z.literal(QUOTE_PAYLOAD_SHA256_SPEC),
    input_base_bounds: z.object({ minimum: positive, maximum: positive }).strict(),
    minimum_output_base: positive,
    required_wallet_chains: z.array(chain).min(1).max(6),
    event_signer_public_required: z.boolean(),
    step_count: z.number().int().min(1).max(8),
    recommended_mode: z.enum(["session", "one_shot_or_session"]),
    allowed_modes: z
      .array(z.enum(["one_shot", "session"]))
      .min(1)
      .max(2),
    session_header: z
      .object({
        name: z.literal("X-AssetFare-Session-Token"),
        required_for: z.literal("session"),
        caller_generated: z.literal(true),
        minimum_entropy_bits: z.literal(256),
        server_returns_raw_value: z.literal(false),
      })
      .strict(),
    idempotency: z
      .object({
        required: z.literal(true),
        field: z.literal("idempotency_key"),
        pattern: z.literal("^[A-Za-z0-9._:-]{8,128}$"),
        scope: z.literal("quote_and_selected_mode"),
      })
      .strict(),
    approval_v3_required_fields: z.tuple([
      z.literal(APPROVAL_FIELDS[0]),
      z.literal(APPROVAL_FIELDS[1]),
      z.literal(APPROVAL_FIELDS[2]),
      z.literal(APPROVAL_FIELDS[3]),
      z.literal(APPROVAL_FIELDS[4]),
      z.literal(APPROVAL_FIELDS[5]),
      z.literal(APPROVAL_FIELDS[6]),
      z.literal(APPROVAL_FIELDS[7]),
      z.literal(APPROVAL_FIELDS[8]),
    ]),
    legacy_handoff_enforcement: z.literal("legacy_advisory"),
    server_signing: z.literal(false),
    server_submission: z.literal(false),
  })
  .strict();

type JsonRecord = Record<string, unknown>;

export interface AssetFareContinuationDescriptor {
  version: typeof VERSION;
  quote_id: string;
  quote_fingerprint: string;
  expires_at: string;
  ttl_seconds: number;
  selection_status: "unranked_candidate";
  required_wallet_chains: string[];
  event_signer_public_required: boolean;
  allowed_modes: Array<"one_shot" | "session">;
  recommended_mode: "session" | "one_shot_or_session";
  openapi_url: "https://api.assetfare.dev/v2/openapi";
  legacy_handoff_enforcement: "legacy_advisory";
  automatic_selection_forbidden: true;
  caller_approved_boolean_is_not_human_proof: true;
  wallet_collection_performed: false;
  approval_v3_generated: false;
  prepare_calls: 0;
  session_calls: 0;
  server_signing: false;
  server_submission: false;
}

/**
 * Canonical sorted-key compact JSON used by the REST 2.4 fingerprint contract.
 *
 * @param value - JSON value to encode
 * @returns Canonical JSON text
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as JsonRecord;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonical(object[key])}`)
    .join(",")}}`;
}

/**
 * Returns the lowercase SHA-256 of canonical JSON.
 *
 * @param value - JSON value to hash
 * @returns Lowercase hexadecimal digest
 */
function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

/**
 * Compares ordered arrays without coercion.
 *
 * @param value - Actual ordered values
 * @param expected - Expected ordered values
 * @returns Whether every value matches at the same index
 */
function exactArray(value: readonly unknown[], expected: readonly unknown[]): boolean {
  return value.length === expected.length && value.every((item, index) => item === expected[index]);
}

/**
 * Compares a parsed JSON base-unit number with an exact decimal string, including >2^53 rounding.
 *
 * @param value - Parsed JSON number
 * @param exact - Exact decimal string from the validated summary
 * @returns Whether the parsed number is the JavaScript representation of the exact value
 */
function rawNumberMatches(value: unknown, exact: string): boolean {
  return (
    typeof value === "number" && Number.isInteger(value) && value > 0 && Number(exact) === value
  );
}

/**
 * Renders a finite JSON number as a language-neutral non-exponent decimal.
 *
 * @param value - Finite JSON number
 * @returns Plain decimal representation
 */
function decimalString(value: number): string {
  const source = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(source);
  if (!match) throw new Error("continuation numeric claim invalid");
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
}

/**
 * Reports whether a JavaScript string contains an unpaired UTF-16 surrogate.
 *
 * @param value - String to inspect
 * @returns Whether the string is not valid Unicode scalar text
 */
function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

/**
 * Encodes a JSON value with AssetFare typed-canonical-v1.
 *
 * @param value - JSON value to encode
 * @returns Typed canonical bytes
 */
function typedCanonical(value: unknown): Buffer {
  if (value === null) return Buffer.from("n", "ascii");
  if (value === true) return Buffer.from("t", "ascii");
  if (value === false) return Buffer.from("f", "ascii");
  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      (Number.isInteger(value) && Math.abs(value) > Number.MAX_SAFE_INTEGER)
    )
      throw new Error("continuation payload unsafe number");
    const bytes = Buffer.allocUnsafe(8);
    bytes.writeDoubleBE(value);
    return Buffer.from(`d${bytes.toString("hex")}`, "ascii");
  }
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) throw new Error("continuation payload invalid unicode");
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([Buffer.from(`s${bytes.length}:`, "ascii"), bytes]);
  }
  if (Array.isArray(value))
    return Buffer.concat([
      Buffer.from(`a${value.length}:[`, "ascii"),
      ...value.map(typedCanonical),
      Buffer.from("]", "ascii"),
    ]);
  if (typeof value !== "object") throw new Error("continuation payload invalid");
  const entries = Object.entries(value as JsonRecord).sort(([left], [right]) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
  return Buffer.concat([
    Buffer.from(`o${entries.length}:{`, "ascii"),
    ...entries.flatMap(([key, item]) => [typedCanonical(key), typedCanonical(item)]),
    Buffer.from("}", "ascii"),
  ]);
}

/**
 * Builds the Core 2.4 portable quote-payload projection before hashing.
 *
 * @param quote - Parsed quote response
 * @param summary - Strictly validated direct-route summary
 * @returns Portable quote projection with exact duplicated base units and normalized numbers
 */
function quotePayloadProjection(
  quote: JsonRecord,
  summary: z.infer<typeof AssetFareDirectRouteSummarySchema>,
): JsonRecord {
  const payload = structuredClone(quote);
  delete payload.continuation_v3;
  const intent = payload.intent as JsonRecord | undefined;
  const route = payload.route as JsonRecord | undefined;
  const rawSteps = route?.steps;
  if (!intent || !route || !Array.isArray(rawSteps) || rawSteps.length !== summary.steps.length)
    throw new Error("continuation payload invalid");
  intent.estimated_input_base = summary.steps[0].expected_input_base;
  route.input_base = summary.steps[0].expected_input_base;
  route.expected_output_base = summary.steps[summary.steps.length - 1].expected_output_base;
  route.minimum_output_base = summary.steps[summary.steps.length - 1].minimum_output_base;
  rawSteps.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("continuation payload invalid");
    const raw = item as JsonRecord;
    const exact = summary.steps[index];
    raw.expected_input_base = exact.expected_input_base;
    raw.floor_input_base = exact.minimum_input_base;
    raw.expected_output_base = exact.expected_output_base;
    raw.minimum_output_base = exact.minimum_output_base;
  });
  return payload;
}

/**
 * Hashes the portable quote-payload projection.
 *
 * @param quote - Parsed quote response
 * @param summary - Strictly validated direct-route summary
 * @returns Lowercase SHA-256 digest
 */
function quotePayloadSha256(
  quote: JsonRecord,
  summary: z.infer<typeof AssetFareDirectRouteSummarySchema>,
): string {
  return createHash("sha256")
    .update(typedCanonical(quotePayloadProjection(quote, summary)))
    .digest("hex");
}

/**
 * Validates the complete quote-bound continuation and returns only non-executable discovery metadata.
 *
 * @param quote - Raw AssetFare quote
 * @param summary - Already validated direct-route summary
 * @returns A sanitized unranked descriptor, or undefined on any mismatch
 */
export function validatedContinuationDescriptor(
  quote: JsonRecord,
  summary: z.infer<typeof AssetFareDirectRouteSummarySchema>,
): AssetFareContinuationDescriptor | undefined {
  const parsed = continuationSchema.safeParse(quote.continuation_v3);
  if (!parsed.success) return undefined;
  const continuation = parsed.data;
  const intent = quote.intent as JsonRecord | undefined;
  const route = quote.route as JsonRecord | undefined;
  if (!intent || !route) return undefined;
  const requiredChains = [
    ...new Set(
      summary.steps.flatMap(step => [step.from.split(":", 1)[0], step.to.split(":", 1)[0]]),
    ),
  ].sort();
  const signerRequired = summary.steps.some(
    step => step.provider === "circle_cctp" && step.from.startsWith("solana:"),
  );
  const modes: Array<"one_shot" | "session"> =
    summary.step_count > 1 ? ["session"] : ["one_shot", "session"];
  const recommended = summary.step_count > 1 ? "session" : "one_shot_or_session";
  const inputBase = summary.steps[0].expected_input_base;
  const expectedOutput = summary.steps[summary.steps.length - 1].expected_output_base;
  const minimumOutput = summary.steps[summary.steps.length - 1].minimum_output_base;
  const rawSteps = route.steps;
  if (
    !rawNumberMatches(intent.estimated_input_base, inputBase) ||
    !rawNumberMatches(route.input_base, inputBase) ||
    !rawNumberMatches(route.expected_output_base, expectedOutput) ||
    !rawNumberMatches(route.minimum_output_base, minimumOutput) ||
    !Array.isArray(rawSteps) ||
    rawSteps.length !== summary.steps.length ||
    rawSteps.some((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return true;
      const raw = item as JsonRecord;
      const exact = summary.steps[index];
      return (
        !rawNumberMatches(raw.expected_input_base, exact.expected_input_base) ||
        !rawNumberMatches(raw.floor_input_base, exact.minimum_input_base) ||
        !rawNumberMatches(raw.expected_output_base, exact.expected_output_base) ||
        !rawNumberMatches(raw.minimum_output_base, exact.minimum_output_base)
      );
    })
  )
    return undefined;
  const summaryHash = sha256(summary);
  const payloadHash = quotePayloadSha256(quote, summary);
  const issued = Date.parse(continuation.issued_at);
  const expires = Date.parse(continuation.expires_at);
  const now = Date.now();
  if (
    continuation.quote_id !== quote.quote_id ||
    canonical(continuation.intent) !== canonical(intent) ||
    continuation.direct_route_summary_sha256 !== summaryHash ||
    continuation.quote_payload_sha256 !== payloadHash ||
    continuation.quote_fingerprint_claim.direct_route_summary_sha256 !== summaryHash ||
    continuation.quote_fingerprint_claim.quote_payload_sha256 !== payloadHash ||
    sha256(continuation.quote_fingerprint_claim) !== continuation.quote_fingerprint ||
    continuation.input_base_bounds.minimum !== inputBase ||
    continuation.input_base_bounds.maximum !== inputBase ||
    continuation.minimum_output_base !== minimumOutput ||
    continuation.step_count !== summary.step_count ||
    !exactArray(continuation.required_wallet_chains, requiredChains) ||
    continuation.event_signer_public_required !== signerRequired ||
    !exactArray(continuation.allowed_modes, modes) ||
    continuation.recommended_mode !== recommended ||
    expires - issued !== continuation.ttl_seconds * 1000 ||
    expires <= now ||
    issued > now + 300_000
  )
    return undefined;
  const expectedClaim = {
    version: VERSION,
    quote_id: quote.quote_id,
    issued_at: continuation.issued_at,
    expires_at: continuation.expires_at,
    ttl_seconds: String(continuation.ttl_seconds),
    intent: {
      from: intent.from,
      to: intent.to,
      amount_usd_decimal: decimalString(intent.amount_usd as number),
      estimated_input_base: inputBase,
    },
    direct_route_summary_sha256: summaryHash,
    quote_payload_sha256: payloadHash,
    quote_payload_sha256_spec: QUOTE_PAYLOAD_SHA256_SPEC,
    input_base_bounds: { minimum: inputBase, maximum: inputBase },
    minimum_output_base: minimumOutput,
    required_wallet_chains: requiredChains,
    event_signer_public_required: signerRequired,
    step_count: String(summary.step_count),
    allowed_modes: modes,
    server_signing: false,
    server_submission: false,
  };
  if (canonical(continuation.quote_fingerprint_claim) !== canonical(expectedClaim))
    return undefined;
  return {
    version: VERSION,
    quote_id: continuation.quote_id,
    quote_fingerprint: continuation.quote_fingerprint,
    expires_at: continuation.expires_at,
    ttl_seconds: continuation.ttl_seconds,
    selection_status: "unranked_candidate",
    required_wallet_chains: requiredChains,
    event_signer_public_required: signerRequired,
    allowed_modes: modes,
    recommended_mode: recommended,
    openapi_url: "https://api.assetfare.dev/v2/openapi",
    legacy_handoff_enforcement: "legacy_advisory",
    automatic_selection_forbidden: true,
    caller_approved_boolean_is_not_human_proof: true,
    wallet_collection_performed: false,
    approval_v3_generated: false,
    prepare_calls: 0,
    session_calls: 0,
    server_signing: false,
    server_submission: false,
  };
}
