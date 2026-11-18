import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { WalletProvider, EvmWalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  DiscoverServicesSchema,
  CallServiceSchema,
  GetTreasuryInfoSchema,
  EvaluatorSubmitJobSchema,
  AuditReadinessSchema,
  AuditGetTierPricingSchema,
  HiveConfig,
} from "./schemas";
import {
  HIVE_CHAIN_ID,
  HIVE_TREASURY_ADDRESS,
  USDC_BASE_MAINNET,
  HIVE_DISCOVERY_URL,
  HIVE_EVALUATOR_URL,
  HIVE_BRAND_GOLD,
  HIVE_NETWORK_ID,
  HIVE_DEFAULT_MAX_PAYMENT_USDC,
  HIVE_GITHUB,
  HIVE_AUDIT_READINESS_URL,
  HIVE_AUDIT_TIER_PRICING,
} from "./constants";

/** Internal resolved config — all fields required */
interface ResolvedHiveConfig {
  maxPaymentUsdc: number;
}

/**
 * HiveActionProvider exposes Hive Civilization's x402-wired services to any
 * agent built on Coinbase AgentKit.
 *
 * Hive runs 51 revenue surfaces on Base mainnet. Each surface is a standard
 * x402 endpoint: the agent pays USDC micro-amounts and receives a JSON
 * payload in return. No API keys, no OAuth, no subscriptions — just onchain
 * micro-payments via the x402 protocol.
 *
 * @see https://github.com/srotzin
 * @see https://github.com/coinbase/x402
 */
export class HiveActionProvider extends ActionProvider<WalletProvider> {
  private readonly config: ResolvedHiveConfig;

  /**
   * Creates a new HiveActionProvider.
   *
   * @param config - Optional configuration overrides.
   */
  constructor(config: HiveConfig = {}) {
    super("hive", []);
    this.config = {
      maxPaymentUsdc:
        config.maxPaymentUsdc ??
        parseFloat(process.env.HIVE_MAX_PAYMENT_USDC ?? String(HIVE_DEFAULT_MAX_PAYMENT_USDC)),
    };
  }

  /**
   * Fetches the live Hive service catalog.
   *
   * The discovery endpoint is free (no x402 payment). It returns the full
   * list of Hive surfaces with their tool names, descriptions, and prices.
   *
   * @param _walletProvider - Wallet provider (unused; required by interface).
   * @param _args - No parameters.
   * @returns JSON string containing the service catalog.
   */
  @CreateAction({
    name: "hive_discover_services",
    description: `Fetches the live Hive service catalog from hivegate (free read, no payment required).
Returns a list of all available Hive surfaces with tool names, descriptions, and prices.
Use this first to discover what Hive can do before calling hive_call_service.`,
    schema: DiscoverServicesSchema,
  })
  async discoverServices(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof DiscoverServicesSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(HIVE_DISCOVERY_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            message: `Discovery endpoint returned HTTP ${response.status}`,
            url: HIVE_DISCOVERY_URL,
          },
          null,
          2,
        );
      }

      const catalog = await response.json();

      return JSON.stringify(
        {
          success: true,
          source: HIVE_DISCOVERY_URL,
          treasury: HIVE_TREASURY_ADDRESS,
          chain: `Base mainnet (${HIVE_CHAIN_ID})`,
          usdc: USDC_BASE_MAINNET,
          catalog,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to fetch Hive service catalog",
          details: message,
          url: HIVE_DISCOVERY_URL,
        },
        null,
        2,
      );
    }
  }

  /**
   * Generic x402-paid call wrapper for any Hive service.
   *
   * This is the keystone action. It:
   * 1. Builds a JSON-RPC style MCP request body.
   * 2. Sends it to the service URL.
   * 3. If the server responds 402, pays with the agent's wallet and retries.
   * 4. Returns the service response.
   *
   * The underlying payment is handled by `@x402/fetch` — the same library
   * that powers the existing `make_http_request_with_x402` action.
   *
   * @param walletProvider - The wallet used to sign x402 payments.
   * @param args - Service URL, tool name, tool args, and HTTP method.
   * @returns JSON string with the service response or error.
   */
  @CreateAction({
    name: "hive_call_service",
    description: `Calls any Hive x402-protected service. Handles the 402 challenge/payment/retry cycle automatically.

Workflow:
1. Build a request for the named tool with the provided args.
2. Send to serviceUrl.
3. If the server replies 402, pay USDC from the agent wallet and retry.
4. Return the service result.

All Hive services cost ≤ $0.05 USDC per call on Base mainnet.

Example:
  serviceUrl: "https://hive-mcp-evaluator.onrender.com/mcp"
  toolName: "submit_job"
  toolArgs: { prompt: "Evaluate this text", text: "Hello world" }`,
    schema: CallServiceSchema,
  })
  async callService(
    walletProvider: WalletProvider,
    args: z.infer<typeof CallServiceSchema>,
  ): Promise<string> {
    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details:
              "HiveActionProvider requires an EvmWalletProvider. Hive services run on Base mainnet.",
          },
          null,
          2,
        );
      }

      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: args.toolName,
          arguments: args.toolArgs ?? {},
        },
      };

      const client = this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const method = args.method ?? "POST";
      const response = await fetchWithPayment(args.serviceUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Extract payment proof header (v2: payment-response, v1: x-payment-response)
      const paymentResponseHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");

      let paymentProof: Record<string, unknown> | null = null;
      if (paymentResponseHeader) {
        try {
          paymentProof = JSON.parse(atob(paymentResponseHeader));
        } catch {
          paymentProof = { raw: paymentResponseHeader };
        }
      }

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (response.status !== 200) {
        return JSON.stringify(
          {
            error: true,
            message: `Service returned HTTP ${response.status}`,
            serviceUrl: args.serviceUrl,
            toolName: args.toolName,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          serviceUrl: args.serviceUrl,
          toolName: args.toolName,
          data,
          paymentProof,
          treasury: HIVE_TREASURY_ADDRESS,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "hive_call_service failed",
          details: message,
          serviceUrl: args.serviceUrl,
          toolName: args.toolName,
        },
        null,
        2,
      );
    }
  }

  /**
   * Returns Hive treasury and network constants.
   *
   * Useful for agents that want to verify payment destinations before
   * authorising a spend. All values are on-chain facts.
   *
   * @param _walletProvider - Wallet provider (unused; required by interface).
   * @param _args - No parameters.
   * @returns JSON string with treasury info.
   */
  @CreateAction({
    name: "hive_get_treasury_info",
    description: `Returns Hive treasury address, network (Base mainnet 8453), USDC contract, and brand info.
Use this to verify payment destinations before calling a Hive service.`,
    schema: GetTreasuryInfoSchema,
  })
  async getTreasuryInfo(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof GetTreasuryInfoSchema>,
  ): Promise<string> {
    return JSON.stringify(
      {
        success: true,
        treasury: {
          address: HIVE_TREASURY_ADDRESS,
          chain: "Base mainnet",
          chainId: HIVE_CHAIN_ID,
          networkId: HIVE_NETWORK_ID,
        },
        usdc: {
          contract: USDC_BASE_MAINNET,
          chain: "Base mainnet",
          chainId: HIVE_CHAIN_ID,
        },
        brand: {
          gold: HIVE_BRAND_GOLD,
          github: HIVE_GITHUB,
          discoveryUrl: HIVE_DISCOVERY_URL,
        },
        maxPaymentUsdc: this.config.maxPaymentUsdc,
        note: "All Hive services cost ≤ $0.05 USDC per call. Payment flows through the x402 protocol — no API keys required.",
      },
      null,
      2,
    );
  }

  /**
   * Submits a job to the Hive MCP Evaluator service.
   *
   * This is a concrete copy-paste example. The evaluator costs $0.01 USDC
   * per job and returns a structured evaluation result.
   *
   * @param walletProvider - The wallet used to sign the x402 payment.
   * @param args - The job payload to submit.
   * @returns JSON string with the evaluation result or error.
   */
  @CreateAction({
    name: "hive_evaluator_submit_job",
    description: `Submits a job to the Hive MCP Evaluator ($0.01 USDC per call on Base mainnet).

This is a concrete example of hive_call_service. Copy this pattern for other Hive tools.

Example payload:
  { model: "gpt-4o", prompt: "Evaluate this text for clarity", text: "Hello world" }

Sample receipt: rcpt_76fceca973da4ec0`,
    schema: EvaluatorSubmitJobSchema,
  })
  async evaluatorSubmitJob(
    walletProvider: WalletProvider,
    args: z.infer<typeof EvaluatorSubmitJobSchema>,
  ): Promise<string> {
    // Delegate to hive_call_service — no duplication of x402 logic.
    return this.callService(walletProvider, {
      serviceUrl: `${HIVE_EVALUATOR_URL}/mcp`,
      toolName: "submit_job",
      toolArgs: args.jobPayload,
      method: "POST",
    });
  }

  /**
   * Scores an organization's compliance readiness against one or more
   * regulatory frameworks via the Hive MCP Audit Readiness service.
   *
   * Calls POST https://hivemorph.onrender.com/v1/audit/readiness with the
   * provided input and returns a structured readiness score, gap list, and
   * recommended remediation steps.
   *
   * This endpoint is not x402-gated (free read). No wallet required.
   *
   * @param _walletProvider - Wallet provider (unused; required by interface).
   * @param args - Organization name, frameworks, optional evidence summary, and tier.
   * @returns JSON string with the readiness score or error details.
   */
  @CreateAction({
    name: "hive_audit_readiness_score",
    description: `Scores an organization's compliance readiness against one or more regulatory frameworks.

POSTs to the Hive MCP Audit Readiness service at https://hivemorph.onrender.com/v1/audit/readiness.
No x402 payment required — this is a free scoring call.

Supported frameworks: SOC2, ISO27001, HIPAA, PCIDSS, NIST_CSF, FedRAMP, CMMC, FISMA.

Example:
  org_name: "Acme Corp"
  frameworks: ["SOC2", "HIPAA"]
  evidence_summary: "We have a written information security policy and conduct annual employee training."
  tier: "STANDARD"

Returns a readiness score (0\u2013100), identified gaps, and a prioritized remediation roadmap.`,
    schema: AuditReadinessSchema,
  })
  async auditReadinessScore(
    _walletProvider: WalletProvider,
    args: z.infer<typeof AuditReadinessSchema>,
  ): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        org_name: args.org_name,
        frameworks: args.frameworks,
      };
      if (args.evidence_summary !== undefined) {
        payload.evidence_summary = args.evidence_summary;
      }
      if (args.tier !== undefined) {
        payload.tier = args.tier;
      }

      const response = await fetch(HIVE_AUDIT_READINESS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            message: `Audit Readiness service returned HTTP ${response.status}`,
            url: HIVE_AUDIT_READINESS_URL,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          service: "HiveAudit Readiness",
          url: HIVE_AUDIT_READINESS_URL,
          org_name: args.org_name,
          frameworks: args.frameworks,
          tier: args.tier ?? "STARTER",
          result: data,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "hive_audit_readiness_score failed",
          details: message,
          url: HIVE_AUDIT_READINESS_URL,
        },
        null,
        2,
      );
    }
  }

  /**
   * Returns the inlined HiveAudit Readiness four-tier pricing card.
   *
   * No network call required. Values are sourced from constants.ts.
   *
   * @param _walletProvider - Wallet provider (unused; required by interface).
   * @param _args - No parameters.
   * @returns JSON string with tier pricing details.
   */
  @CreateAction({
    name: "hive_audit_get_tier_pricing",
    description: `Returns the HiveAudit Readiness four-tier annual pricing card. No parameters required.

Tiers:
  STARTER    \u2014 $500/yr   \u2014 Foundational gap analysis (NIST CSF, SOC 2 Type I, HIPAA basics)
  STANDARD   \u2014 $1,500/yr \u2014 Full scoring + remediation roadmap (ISO 27001, SOC 2 Type II, PCI DSS L4)
  ENTERPRISE \u2014 $2,500/yr \u2014 Continuous monitoring + auditor-ready reports (FedRAMP Moderate, CMMC L2)
  FEDERAL    \u2014 $7,500/yr \u2014 Maximum coverage for federal contractors (FedRAMP High, CMMC L3, FISMA, DISA STIG)`,
    schema: AuditGetTierPricingSchema,
  })
  async auditGetTierPricing(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof AuditGetTierPricingSchema>,
  ): Promise<string> {
    return JSON.stringify(
      {
        success: true,
        service: "HiveAudit Readiness",
        url: HIVE_AUDIT_READINESS_URL,
        brand_gold: HIVE_BRAND_GOLD,
        tiers: HIVE_AUDIT_TIER_PRICING,
        note: "All tiers are billed annually in USD. Contact Hive to discuss custom enterprise arrangements.",
        contact: HIVE_GITHUB,
      },
      null,
      2,
    );
  }

  /**
   * HiveActionProvider supports Base mainnet only (all Hive services).
   *
   * @param network - The network to check.
   * @returns True if Base mainnet.
   */
  supportsNetwork = (network: Network): boolean =>
    network.networkId === HIVE_NETWORK_ID || network.chainId === String(HIVE_CHAIN_ID);

  /**
   * Creates an x402 client configured for the given EVM wallet provider.
   *
   * @param walletProvider - An EvmWalletProvider instance.
   * @returns Configured x402Client.
   */
  private createX402Client(walletProvider: EvmWalletProvider): x402Client {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      readContract: (params: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: params.address,
          abi: params.abi as never,
          functionName: params.functionName as never,
          args: params.args as never,
        }),
    };
    registerExactEvmScheme(client, { signer });
    return client;
  }
}

/** Factory function — matches AgentKit convention. */
export const hiveActionProvider = (config?: HiveConfig) => new HiveActionProvider(config);
