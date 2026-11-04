import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  PolymarketOddsSchema,
  PolymarketDisagreementSchema,
  PolymarketPackageSchema,
  HyperliquidFundingSchema,
} from "./schemas";

/**
 * Base URL for the Curade market-data API.
 */
const CURADE_BASE_URL = "https://api.curade.xyz";

/**
 * Extract a human-readable message from an unknown error.
 *
 * @param error - The error to extract a message from.
 * @returns A human-readable error message string.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  const str = String(error);
  if (str === "[object Object]") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return str;
}

/**
 * Format a clean, agent-readable message for an HTTP 402 x402 payment challenge.
 *
 * This provider never signs payments: x402 signing is delegated to x402-enabled
 * wallet clients (e.g. AgentKit's X402ActionProvider or an x402-fetch wrapper
 * backed by an EVM wallet). The raw challenge is surfaced so the caller can
 * settle it and retry.
 *
 * @param body - Raw body of the HTTP 402 response (the x402 PaymentRequired object).
 * @returns A human-readable payment-required message including the challenge.
 */
function formatX402Challenge(body: string): string {
  return [
    "Payment required (HTTP 402): this Curade endpoint is pay-per-call via the x402 protocol in USDC.",
    "The challenge below is the x402 PaymentRequired object (x402Version, accepts[] with USDC terms: scheme, network, asset, payTo, maxAmountRequired).",
    "To proceed, settle the challenge with an x402-enabled wallet client (e.g. AgentKit's X402ActionProvider or an x402-fetch wrapper signing EIP-3009 USDC), then retry the exact same request with the signed payment in the header the challenge's `error` field names (Curade's v2 endpoint expects `Payment-Signature`).",
    `Challenge: ${body}`,
  ].join("\n");
}

/**
 * CuradeActionProvider provides actions for the Curade x402-paid market-data API.
 *
 * Curade (https://curade.xyz) serves derived prediction-market and perp-funding
 * analytics with venue attribution (Polymarket, Kalshi, Limitless, Hyperliquid).
 * All four endpoints are pay-per-call via the x402 protocol: unpaid calls return
 * HTTP 402 with an x402 payment challenge, which these tools surface verbatim.
 * Payment signing is intentionally NOT implemented here — use an x402-enabled
 * wallet client to settle the challenge and retry.
 */
export class CuradeActionProvider extends ActionProvider {
  /**
   * Creates a new CuradeActionProvider instance.
   */
  constructor() {
    super("curade", []);
  }

  /**
   * Get the latest Polymarket odds snapshot.
   *
   * @param args - The odds query parameters.
   * @returns JSON string with the snapshot rows, or the x402 402 challenge.
   */
  @CreateAction({
    name: "curade_polymarket_odds",
    description: `Get the latest Polymarket odds snapshot from the Curade market-data API (https://api.curade.xyz).
Pay-per-call via the x402 protocol in USDC ($0.005 per call): an unpaid call returns HTTP 402 with the x402 payment challenge, which this tool surfaces verbatim — settle it with an x402-enabled wallet client and retry.
Derived data: volume-ranked snapshot rows collected from Polymarket. Venue attribution: Polymarket (Curade's prediction-market sources span Polymarket, Kalshi, and Limitless).

Inputs:
- limit: Max rows, 0-200, default 25 (optional)
- q: Case-insensitive substring filter on the market question (optional)`,
    schema: PolymarketOddsSchema,
  })
  async polymarketOdds(args: z.infer<typeof PolymarketOddsSchema>): Promise<string> {
    const params = new URLSearchParams();
    if (args.limit !== undefined) {
      params.set("limit", String(args.limit));
    }
    if (args.q !== undefined) {
      params.set("q", args.q);
    }
    const query = params.toString();
    return this.getFromCurade(`${CURADE_BASE_URL}/v1/polymarket/odds${query ? `?${query}` : ""}`);
  }

  /**
   * Get the Polymarket vs Kalshi cross-venue disagreement report.
   *
   * @param _args - Empty args object.
   * @returns JSON string with the disagreement report, or the x402 402 challenge.
   */
  @CreateAction({
    name: "curade_polymarket_disagreement",
    description: `Get the Polymarket vs Kalshi cross-venue disagreement report from the Curade market-data API (https://api.curade.xyz).
Pay-per-call via the x402 protocol in USDC ($0.02 per call): an unpaid call returns HTTP 402 with the x402 payment challenge, which this tool surfaces verbatim — settle it with an x402-enabled wallet client and retry.
Derived data: cross-venue disagreement between the latest Polymarket snapshot and live Kalshi markets. Venue attribution: Polymarket and Kalshi (Curade's prediction-market sources span Polymarket, Kalshi, and Limitless).

Inputs: none`,
    schema: PolymarketDisagreementSchema,
  })
  async polymarketDisagreement(
    _args: z.infer<typeof PolymarketDisagreementSchema>,
  ): Promise<string> {
    return this.getFromCurade(`${CURADE_BASE_URL}/v1/polymarket/disagreement`);
  }

  /**
   * Purchase the full attested data package for one Polymarket market.
   *
   * @param args - The package parameters.
   * @returns JSON string with the attested package and signed license, or the x402 402 challenge.
   */
  @CreateAction({
    name: "curade_polymarket_package",
    description: `Purchase the full attested data package for one Polymarket market from the Curade market-data API (https://api.curade.xyz).
One-time purchase via the x402 protocol in USDC ($2.00 per market; payment settles before delivery): an unpaid call returns HTTP 402 with the x402 payment challenge, which this tool surfaces verbatim — settle it with an x402-enabled wallet client and retry. Keep the data: the response includes the attested package plus a signed license token.
Derived data: full attested data package for a single Polymarket market. Venue attribution: Polymarket (Curade's prediction-market sources span Polymarket, Kalshi, and Limitless).

Inputs:
- market: Polymarket market slug-or-id, matched exactly, case-insensitive`,
    schema: PolymarketPackageSchema,
  })
  async polymarketPackage(args: z.infer<typeof PolymarketPackageSchema>): Promise<string> {
    const params = new URLSearchParams();
    params.set("market", args.market);
    return this.getFromCurade(`${CURADE_BASE_URL}/v1/polymarket/package?${params.toString()}`);
  }

  /**
   * Get the latest Hyperliquid funding-rate snapshot.
   *
   * @param args - The funding query parameters.
   * @returns JSON string with the funding snapshot, or the x402 402 challenge.
   */
  @CreateAction({
    name: "curade_hyperliquid_funding",
    description: `Get the latest Hyperliquid funding-rate snapshot from the Curade market-data API (https://api.curade.xyz).
Pay-per-call via the x402 protocol in USDC ($0.001 per call): an unpaid call returns HTTP 402 with the x402 payment challenge, which this tool surfaces verbatim — settle it with an x402-enabled wallet client and retry.
Derived data: per-coin Hyperliquid perpetual-funding snapshot ranked by open interest (funding_rate is the signed hourly rate — positive means longs pay shorts — and apr is the annualized percent). Venue attribution: Hyperliquid.

Inputs:
- limit: Max coins served, ranked by open interest (desc), 1-100, default 100 (optional)`,
    schema: HyperliquidFundingSchema,
  })
  async hyperliquidFunding(args: z.infer<typeof HyperliquidFundingSchema>): Promise<string> {
    const params = new URLSearchParams();
    if (args.limit !== undefined) {
      params.set("limit", String(args.limit));
    }
    const query = params.toString();
    return this.getFromCurade(`${CURADE_BASE_URL}/v1/funding/current${query ? `?${query}` : ""}`);
  }

  /**
   * Perform a GET request against the Curade API.
   *
   * Surfaces the HTTP 402 x402 payment challenge cleanly instead of throwing;
   * no payment signing happens here (x402-enabled wallet clients handle it).
   *
   * @param url - The full URL to GET.
   * @returns The response body, the 402 challenge, or an error message.
   */
  private async getFromCurade(url: string): Promise<string> {
    try {
      const response = await fetch(url);

      if (response.status === 402) {
        return formatX402Challenge(await response.text());
      }

      const body = await response.text();

      if (!response.ok) {
        return `Error calling Curade API (${url}): HTTP ${response.status} ${body}`;
      }

      return body;
    } catch (error) {
      return `Error calling Curade API (${url}): ${getErrorMessage(error)}`;
    }
  }

  /**
   * Check if the provider supports the given network.
   * Curade settles x402 payments in USDC on EVM networks (e.g. Base).
   *
   * @param network - The network to check.
   * @returns True if the network is EVM-based.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm";
  }
}

/**
 * Factory function to create a new CuradeActionProvider instance.
 *
 * @returns A new CuradeActionProvider
 */
export const curadeActionProvider = () => new CuradeActionProvider();
