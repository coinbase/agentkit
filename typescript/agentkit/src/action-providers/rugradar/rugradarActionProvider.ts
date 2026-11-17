import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { CheckSolanaTokenRiskSchema, ScanLinkForDrainerSchema } from "./schemas";
import { MAX_FLAGS, RUGRADAR_AGENTS_URL, RUGRADAR_BASE_URL } from "./constants";
import {
  RugRadarActionProviderConfig,
  RugRadarFlag,
  RugRadarLinkResponse,
  RugRadarTokenResponse,
} from "./types";

/**
 * Formats a list of RugRadar flags as bullet lines, most severe first.
 *
 * @param flags - The flags returned by RugRadar
 * @returns The formatted lines
 */
function formatFlags(flags: RugRadarFlag[] = []): string {
  const order: Record<string, number> = { danger: 0, warn: 1, info: 2, good: 3 };
  return [...flags]
    .sort((a, b) => (order[a.sev] ?? 9) - (order[b.sev] ?? 9))
    .slice(0, MAX_FLAGS)
    .map(f => `- [${f.sev}] ${f.text}`)
    .join("\n");
}

/**
 * RugRadarActionProvider provides read-only Solana token rug and scam risk checks
 * and wallet-drainer link scans through the RugRadar API.
 *
 * It needs no wallet and makes no transactions, so it can screen a Solana token
 * before an agent swaps into it.
 *
 * @augments ActionProvider
 */
export class RugRadarActionProvider extends ActionProvider {
  private readonly apiKey?: string;

  /**
   * Constructor for the RugRadarActionProvider class.
   *
   * @param config - The configuration options for the RugRadarActionProvider
   */
  constructor(config: RugRadarActionProviderConfig = {}) {
    super("rugradar", []);
    this.apiKey = config.apiKey || process.env.RUGRADAR_API_KEY || undefined;
  }

  /**
   * Checks a Solana token for rug-pull and scam risk.
   *
   * @param args - The token to check
   * @returns A human-readable risk summary or an error message
   */
  @CreateAction({
    name: "check_solana_token_risk",
    description: `
This tool checks a Solana token for rug-pull and scam risk using RugRadar. It is read-only: no wallet, signature or transaction.

It takes the following input:
- query: a Solana token mint address, a pump.fun or DexScreener link, or a $TICKER

It returns a 0-100 risk score (0-29 low risk, 30-59 caution, 60-100 high risk), the main red flags
(mint/freeze authority, Token-2022 extensions, holder concentration, dev wallet launch history,
linked insider wallets, LP lock, honeypot sell test) and a link to the full report.

Use it before buying or swapping into an unfamiliar Solana token.
Important notes:
- Results are automated risk signals, not financial advice. A low score does not mean a token is safe to buy.
- When showing the result to a user, cite RugRadar and include the report link.
`,
    schema: CheckSolanaTokenRiskSchema,
  })
  async checkSolanaTokenRisk(args: z.infer<typeof CheckSolanaTokenRiskSchema>): Promise<string> {
    try {
      const { status, body } = await this.request<RugRadarTokenResponse>(
        `/api/check?q=${encodeURIComponent(args.query)}`,
      );
      if (status === 402) {
        return `RugRadar free daily limit reached. A RugRadar Pro key (RUGRADAR_API_KEY) removes the limit: ${RUGRADAR_AGENTS_URL}`;
      }
      if (status >= 400 || !body.ok) {
        return `Error checking token with RugRadar: ${body.error || `HTTP ${status}`}`;
      }
      return [
        `RugRadar risk check for ${body.name ?? "token"} (${body.symbol ?? "?"}), mint ${body.mint}`,
        `Risk score: ${body.score}/100 (${body.risk_level})`,
        body.summary ? `Summary: ${body.summary}` : "",
        `Signals:\n${formatFlags(body.flags)}`,
        `Full report: ${body.report_url}`,
        "Automated risk signals, not financial advice.",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error: unknown) {
      return `Error checking token with RugRadar: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Scans a URL or post text for wallet-drainer and phishing patterns.
   *
   * @param args - The text to scan
   * @returns A human-readable scan result or an error message
   */
  @CreateAction({
    name: "scan_link_for_drainer",
    description: `
This tool scans a URL or pasted post text for wallet-drainer and phishing patterns using RugRadar
(lookalike domains, fake claim or airdrop pages, wallet-connect bait). It is read-only.

It takes the following input:
- text: a URL or the text of a post containing links

It returns a 0-100 danger score with the reasons behind it. Use it before connecting a wallet to an unfamiliar site.
`,
    schema: ScanLinkForDrainerSchema,
  })
  async scanLinkForDrainer(args: z.infer<typeof ScanLinkForDrainerSchema>): Promise<string> {
    try {
      const { status, body } = await this.request<RugRadarLinkResponse>(
        `/api/scan-link?text=${encodeURIComponent(args.text)}`,
      );
      if (status === 402) {
        return `RugRadar free daily limit reached. A RugRadar Pro key (RUGRADAR_API_KEY) removes the limit: ${RUGRADAR_AGENTS_URL}`;
      }
      if (status >= 400 || body.ok === false) {
        return `Error scanning link with RugRadar: ${body.error || `HTTP ${status}`}`;
      }
      return [
        `RugRadar link scan: ${body.score}/100 (${body.verdict})`,
        body.summary ? `Summary: ${body.summary}` : "",
        body.flags?.length ? `Reasons:\n${formatFlags(body.flags)}` : "",
        "Heuristic scan by RugRadar. Never share a seed phrase or sign a transaction you did not start.",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error: unknown) {
      return `Error scanning link with RugRadar: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * RugRadar is a plain HTTP API that needs no wallet, so it works with any network.
   *
   * @param _ - The network to check
   * @returns Always true
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Calls a RugRadar GET endpoint.
   *
   * @param path - The path and query string
   * @returns The HTTP status and parsed JSON body
   */
  private async request<T>(path: string): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await fetch(`${RUGRADAR_BASE_URL}${path}`, { headers });
    const body = (await response.json()) as T;
    return { status: response.status, body };
  }
}

/**
 * Factory function to create a new RugRadarActionProvider instance.
 *
 * @param config - The configuration options for the RugRadarActionProvider
 * @returns A new instance of RugRadarActionProvider
 */
export const rugradarActionProvider = (config: RugRadarActionProviderConfig = {}) =>
  new RugRadarActionProvider(config);
