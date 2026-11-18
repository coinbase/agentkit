import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { RateWalletSchema, GetVaultRankingsSchema, GetIntegrityReportSchema } from "./schemas";
import { BEAVER_KNIGHT_BASE_URL } from "./constants";

/**
 * BeaverKnightActionProvider gives an agent read access to Beaver Knight, a trust bureau for
 * autonomous trading agents. The bureau rates agents and vaults on what they actually did with real
 * money on chain (realised P&L read from the venue itself, with a statistical-significance gate),
 * publishes the rating whether or not the subject asked, and attests ratings on Base via EAS from a
 * canister-controlled address that has no private key.
 *
 * All actions are public, unauthenticated, read-only, and network-agnostic.
 *
 * Two conventions every consumer must respect:
 * - An unrated address comes back as `found: false`. That is an ABSENCE OF EVIDENCE, not a clean bill
 *   of health. Never treat a miss as a pass.
 * - `findings` (things the bureau holds against the subject) and `limits` (gaps in the bureau's own
 *   reach) are separate lists. Merging them turns a coverage gap into an accusation.
 */
export class BeaverKnightActionProvider extends ActionProvider {
  private readonly baseUrl: string;

  /**
   * Constructor for the BeaverKnightActionProvider class.
   *
   * @param baseUrl - Optional override of the bureau base URL (defaults to the public bureau).
   */
  constructor(baseUrl: string = BEAVER_KNIGHT_BASE_URL) {
    super("beaverknight", []);
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Looks up the Beaver Knight rating for a wallet or token address.
   *
   * @param args - The lookup parameters
   * @returns A JSON string with the rating, or a `found:false` warning, or an error message
   */
  @CreateAction({
    name: "rate_wallet",
    description: `This tool checks a counterparty against the Beaver Knight trust bureau by address.
It takes the following input:
- wallet: the address to look up (EVM 0x... or Solana base58). It matches an agent's execution wallet, owner wallet or token.

It returns JSON with:
- found: whether the bureau has a rating for this address
- rating: score (0-99), level (strong | solid | fair | unproven | flag), status, verdict, venue, size, ratedAt, stale
- meaning: what the level means, in words
- findings: statements ABOUT THE SUBJECT (e.g. lost value, high leverage, dormant)
- limits: statements ABOUT THE BUREAU'S REACH (e.g. insufficient track record) - keep these separate from findings
- links: the human report and badge

Important notes:
- found:false is an ABSENCE OF EVIDENCE, NOT A CLEAN BILL OF HEALTH. Do not treat a miss as a pass.
- If the bureau record cannot be read the tool returns an error ("could not check"); that is NOT "unrated".
- Ratings are derived from realised on-chain performance, not from feedback or self-reports.`,
    schema: RateWalletSchema,
  })
  async rateWallet(args: z.infer<typeof RateWalletSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/api/rate?wallet=${encodeURIComponent(args.wallet)}`;
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        return `Error checking wallet: the bureau answered HTTP ${response.status} (this means "could not check", NOT "unrated"). ${text}`;
      }
      return text;
    } catch (error: unknown) {
      return `Error checking wallet: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Returns the vaults on the Beaver Knight board, ranked.
   *
   * @param args - Sort and filter parameters
   * @returns A JSON string with the ranked vaults, or an error message
   */
  @CreateAction({
    name: "get_vault_rankings",
    description: `This tool lists trading vaults (Hyperliquid vaults and ERC-4626 yield vaults) rated by the Beaver Knight bureau, ranked.
It takes the following optional inputs:
- sort: score (default) | return | sharpe | sortino | calmar | drawdown | tvl | decisions
- level: comma-separated levels to include, e.g. "strong,solid"
- minTvl: minimum TVL in USD
- venue: e.g. "Hyperliquid"
- limit: how many to return (default 25, max 100)

Each ranked vault carries: id (use it with get_integrity_report), name, venue, address, score, level, verdict,
figures {tvlUsd, returnPct, realizedPnlUsd, winRatePct, sharpe, sortino, calmar, maxDrawdownPct, decisions, tStat, edgeIsReal, realizedSharePct, grossLeverage},
findings, limits, and links.

Important notes:
- A null figure means the bureau could not measure it. It never means zero.
- edgeIsReal reports whether the edge passes a statistical significance test. A high return over few decisions with edgeIsReal false is a good run, not a good vault.
- Withdrawn ratings are listed under "withdrawn" and hold no rank.
- This is the bureau's own census; nothing here is paid placement and no vault can opt out.`,
    schema: GetVaultRankingsSchema,
  })
  async getVaultRankings(args: z.infer<typeof GetVaultRankingsSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.sort) params.set("sort", args.sort);
      if (args.level) params.set("level", args.level);
      if (args.minTvl !== null && args.minTvl !== undefined)
        params.set("min_tvl", String(args.minTvl));
      if (args.venue) params.set("venue", args.venue);
      params.set("limit", String(args.limit ?? 25));
      const url = `${this.baseUrl}/api/vaults?${params.toString()}`;
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        return `Error fetching vault rankings: HTTP ${response.status}. ${text}`;
      }
      return text;
    } catch (error: unknown) {
      return `Error fetching vault rankings: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Returns the full Integrity Report for one rated record.
   *
   * @param args - The record identifier
   * @returns A JSON string with the report, a `found:false` warning, or an error message
   */
  @CreateAction({
    name: "get_integrity_report",
    description: `This tool fetches the Beaver Knight Integrity Report for one rated agent or vault.
It takes the following input:
- id: a board id (from get_vault_rankings), a Virtuals ACP agent id, or a wallet/token address

It returns JSON with: subject, rating (score, level, verdict, headline, ratedAt, stale, dormant), meaning,
figures (for vaults), every metric with its value, the factor breakdown that produced the score, findings and
limits (kept separate), disclosures, recent performance windows, the track-record span, a "basis" line that
says how to re-derive every number from the venue's public API, and provenance.

provenance.attestation, when present, is the on-chain EAS attestation of this rating on Base: uid, txHash,
schemaUid, and the attester address (a canister-controlled address with no private key). When it is null the
record has not been attested yet - that means "not attested", not "unrated".

Important notes:
- found:false is an ABSENCE OF EVIDENCE, NOT A CLEAN BILL OF HEALTH.
- A retracted rating is marked retracted and should not be relied on.`,
    schema: GetIntegrityReportSchema,
  })
  async getIntegrityReport(args: z.infer<typeof GetIntegrityReportSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/api/report/${encodeURIComponent(args.id)}`;
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        return `Error fetching integrity report: the bureau answered HTTP ${response.status} (this means "could not check", NOT "unrated"). ${text}`;
      }
      return text;
    } catch (error: unknown) {
      return `Error fetching integrity report: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Beaver Knight is a read-only HTTP API, so it is available on every network.
   *
   * @returns True always.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the Beaver Knight action provider.
 *
 * @param baseUrl - Optional override of the bureau base URL.
 * @returns A new BeaverKnightActionProvider instance
 */
export const beaverknightActionProvider = (baseUrl?: string) =>
  new BeaverKnightActionProvider(baseUrl);
