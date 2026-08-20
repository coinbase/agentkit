import { z } from "zod";
import { VAULT_SORT_KEYS } from "./constants";

/**
 * Input schema for rating a wallet (the counterparty check).
 */
export const RateWalletSchema = z
  .object({
    wallet: z
      .string()
      .min(4)
      .describe(
        "The address to look up: an agent's execution wallet, owner wallet or token. EVM (0x...) or Solana (base58).",
      ),
  })
  .strict();

/**
 * Input schema for the ranked vault list.
 */
export const GetVaultRankingsSchema = z
  .object({
    sort: z
      .enum(VAULT_SORT_KEYS)
      .nullable()
      .describe(
        "Ranking key: score (default, the bureau's 0-99 trust score), return, sharpe, sortino, calmar, drawdown, tvl, decisions. Leave null for the default.",
      ),
    level: z
      .string()
      .nullable()
      .describe(
        "Comma-separated levels to include, e.g. 'strong,solid'. Levels: strong, solid, fair, unproven, flag. Leave null for all.",
      ),
    minTvl: z.number().nullable().describe("Minimum TVL in USD, or null."),
    venue: z
      .string()
      .nullable()
      .describe("Venue filter, e.g. 'Hyperliquid', or null for all venues."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .describe("How many ranked vaults to return (1-100). Leave null for 25."),
  })
  .strict();

/**
 * Input schema for one Integrity Report.
 */
export const GetIntegrityReportSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        "The record to report on: a Beaver Knight board id (as returned by get_vault_rankings), a Virtuals ACP agent id, or a wallet/token address.",
      ),
  })
  .strict();
