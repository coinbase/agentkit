import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { WalletProvider } from "../../wallet-providers";
import {
  CheckSellerVerdictSchema,
  GetCensusLeaderboardSchema,
  X402GuardConfig,
} from "./schemas";

const DEFAULT_GATEWAY = "https://enclave402.com";
const VERDICT_PATH = "/api/census/verdict";
const CENSUS_PATH = "/census";

/**
 * X402GuardActionProvider adds pre-payment trust checking to AgentKit.
 *
 * Before an agent pays an x402 seller, this provider queries a live census
 * of 8,000+ Bazaar-listed endpoints and returns a signed verdict:
 *   pay     — seller is compliant and has real buyer activity
 *   caution — partial compliance (missing schema, low usage, etc.)
 *   avoid   — do not pay (no 402 response, missing headers, unreachable)
 *
 * Each verdict is signed with EIP-712 by the census attestor so a router
 * or auditor can verify it offline without trusting the gateway.
 *
 * Answers: https://github.com/coinbase/agentkit/issues/1476
 */
export class X402GuardActionProvider extends ActionProvider<WalletProvider> {
  private readonly gateway: string;

  constructor(config: X402GuardConfig = {}) {
    super("x402Guard", []);
    this.gateway = (
      config.gateway ?? process.env.X402_GUARD_GATEWAY ?? DEFAULT_GATEWAY
    ).replace(/\/+$/, "");
  }

  @CreateAction({
    name: "check_seller_verdict",
    description:
      "Check whether an x402 seller endpoint is safe to pay. " +
      "Returns a verdict (pay / caution / avoid), the seller's trust score (0–100), " +
      "latency, schema declaration status, and a cryptographic attestation. " +
      "Call this BEFORE paying any x402 endpoint you have not verified.",
    schema: CheckSellerVerdictSchema,
  })
  async checkSellerVerdict(
    _walletProvider: WalletProvider,
    args: z.infer<typeof CheckSellerVerdictSchema>,
  ): Promise<string> {
    const url = `${this.gateway}${VERDICT_PATH}?resource=${encodeURIComponent(args.url)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return JSON.stringify({
        error: `Verdict lookup returned HTTP ${res.status}`,
        detail:
          res.status === 402
            ? "The verdict endpoint requires a $0.002 USDC payment. " +
              "Use the x402 action provider to make the request, or query the free /census leaderboard."
            : await res.text().catch(() => ""),
      });
    }

    const data = await res.json();
    const item =
      Array.isArray(data.items) && data.items.length > 0
        ? data.items[0]
        : null;

    if (!item) {
      return JSON.stringify({
        verdict: "unknown",
        detail: "No verdict found for this resource. It may not be listed on the Bazaar.",
        resource: args.url,
      });
    }

    return JSON.stringify({
      verdict: item.verdict,
      score: item.score,
      resource: item.resource,
      host: item.host,
      latencyMs: item.latencyMs,
      schemaDeclared: item.schemaDeclared,
      checkedAt: item.checkedAt,
      stale: item.stale ?? false,
      attestation: item.attestation ?? null,
      recommendation:
        item.verdict === "avoid"
          ? "DO NOT PAY this endpoint. It failed compliance checks."
          : item.verdict === "caution"
            ? "Proceed with caution. Partial compliance — verify the response matches expectations."
            : "Safe to pay. Seller is compliant with real buyer activity.",
    });
  }

  @CreateAction({
    name: "get_census_leaderboard",
    description:
      "Get the top x402 sellers by trust score from the live census. " +
      "Returns up to 100 endpoints ranked by score and unique payer count. " +
      "Use this to discover reliable sellers before making purchases.",
    schema: GetCensusLeaderboardSchema,
  })
  async getCensusLeaderboard(
    _walletProvider: WalletProvider,
  ): Promise<string> {
    const url = `${this.gateway}${CENSUS_PATH}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return JSON.stringify({
        error: `Census returned HTTP ${res.status}`,
      });
    }

    const data = await res.json();

    return JSON.stringify({
      generatedAt: data.generatedAt,
      totalAssessed: data.assessed,
      verdictCounts: data.counts,
      attestor: data.attestor,
      top: (data.top ?? []).slice(0, 20).map((e: Record<string, unknown>) => ({
        resource: e.resource,
        host: e.host,
        verdict: e.verdict,
        score: e.score,
        priceUsdc: e.priceUsdc,
        latencyMs: e.latencyMs,
        uniquePayers30d: e.uniquePayers30d,
      })),
    });
  }

  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

export const x402GuardActionProvider = (config?: X402GuardConfig) =>
  new X402GuardActionProvider(config);
