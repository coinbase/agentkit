import { z } from "zod";

/**
 * Input schema for fetching a translated transaction.
 *
 * The API expects a transaction hash and a chain identifier.
 */
export const NovesTranslatedTxSchema = z.object({
  tx: z.string().describe("Transaction hash"),
  chain: z.string().describe("Chain identifier (e.g., eth, base etc.)"),
});

/**
 * Input schema for fetching recent transactions.
 *
 * The API expects a chain identifier and a wallet address.
 */
export const NovesRecentTxsSchema = z.object({
  chain: z.string().describe("Chain identifier (e.g., eth, base etc.)"),
  wallet: z.string().describe("Wallet address"),
});

/**
 * Input schema for fetching the current price of a token.
 *
 * The API expects a chain identifier, token address, and timestamp (optional).
 */
export const NovesTokenCurrentPriceSchema = z.object({
  chain: z.string().describe("Chain identifier (e.g., eth, base etc.)"),
  token_address: z.string().describe("Token address"),
  timestamp: z.string().optional().describe("Timestamp in seconds"),
});
