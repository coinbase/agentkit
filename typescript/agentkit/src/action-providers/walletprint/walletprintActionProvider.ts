import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { ScoreTransactionSchema } from "./schemas";

const DEFAULT_BASE_URL = "https://walletprint.up.railway.app";
const SUPPORTED_CHAIN_IDS = new Set(["1", "8453"]);

/**
 * Configuration options for WalletPrintActionProvider.
 */
export interface WalletPrintConfig {
  /** WalletPrint API key. Use "walletprint-dev-key" for sandbox testing. */
  apiKey: string;
  /** Optional base URL override. Defaults to the production API. */
  baseUrl?: string;
}

/**
 * WalletPrintActionProvider provides behavioral transaction risk scoring for AI agent wallets.
 * It calls the WalletPrint API to score proposed transactions against the wallet's own
 * behavioral history before they are signed.
 *
 * This action is advisory only — the agent decides what to do with the result.
 */
export class WalletPrintActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Constructs a new WalletPrintActionProvider.
   *
   * @param config - Configuration including API key and optional base URL.
   */
  constructor(config: WalletPrintConfig) {
    super("walletprint", []);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Scores a proposed transaction against the sending wallet's behavioral history.
   * Call this before executing a transaction to get a behavioral risk assessment.
   *
   * @param args - The transaction details to score.
   * @returns A plain-English risk assessment the agent can read and act on.
   */
  @CreateAction({
    name: "score_transaction",
    description: `Score a proposed transaction against the sending wallet's behavioral history before signing.

This action is ADVISORY ONLY — it never blocks a transaction. The agent decides what to do with the result.
Call it before send_transaction or equivalent signing actions when you want a behavioral risk check.

Inputs:
- to: The recipient address (0x-prefixed)
- value_usd: The USD value of the transaction
- asset: The asset being transferred (e.g. "USDC", "ETH", "WBTC")
- contract_category (optional): Category of the contract being called (e.g. "erc20", "defi", "bridge")

Returns:
- risk_score: 0–100 (higher = riskier)
- band: "low", "medium", or "high"
- reasons: Plain-English list of behavioral anomalies detected (e.g. "New recipient address", "Amount 4x above 30-day average")
- recommendation: Suggested action ("proceed", "review", or "escalate")

Example use: Before sending 50,000 USDC to an address, call score_transaction to check whether the
recipient, amount, or timing looks unusual relative to this wallet's history. If the band is "high",
consider pausing and asking the user to confirm before proceeding.
`,
    schema: ScoreTransactionSchema,
  })
  async scoreTransaction(args: z.infer<typeof ScoreTransactionSchema>): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          to: args.to,
          value_usd: args.value_usd,
          asset: args.asset,
          ...(args.contract_category ? { contract_category: args.contract_category } : {}),
        }),
      });

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `WalletPrint API error: HTTP ${response.status}`,
        });
      }

      const data = await response.json();

      const reasons: string[] = Array.isArray(data.reasons) ? data.reasons : [];
      const reasonSummary =
        reasons.length > 0 ? reasons.join("; ") : "No specific anomalies detected";

      return JSON.stringify({
        success: true,
        risk_score: data.risk_score,
        band: data.band,
        reasons: reasons,
        recommendation: data.recommendation ?? (data.band === "high" ? "escalate" : data.band === "medium" ? "review" : "proceed"),
        summary: `Risk score: ${data.risk_score}/100 (${data.band}). ${reasonSummary}.`,
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error calling WalletPrint API: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the WalletPrint action provider supports the given network.
   * Supports Ethereum mainnet (chain ID 1) and Base (chain ID 8453).
   *
   * @param network - The network to check.
   * @returns True if the network is supported.
   */
  supportsNetwork = (network: Network): boolean => {
    return network.chainId !== undefined && SUPPORTED_CHAIN_IDS.has(String(network.chainId));
  };
}

/**
 * Creates a new WalletPrintActionProvider instance.
 *
 * @param config - Configuration including API key and optional base URL.
 * @returns A new WalletPrintActionProvider.
 */
export const walletprintActionProvider = (config: WalletPrintConfig) =>
  new WalletPrintActionProvider(config);
