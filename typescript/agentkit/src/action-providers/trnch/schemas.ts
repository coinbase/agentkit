import { z } from "zod";

const tokenId = z
  .string()
  .nullable()
  .describe("Opaque token id from get_trnch_heat. Provide this or token.");
const token = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .nullable()
  .describe("Token contract address. Provide this or tokenId.");
const slippageBps = z
  .number()
  .int()
  .min(10)
  .max(5000)
  .nullable()
  .transform(val => val ?? 100)
  .describe("Max slippage in basis points (100 = 1%). Default 100.");

/**
 * Input schema for the TRNCH stats.
 */
export const GetTrnchStatsSchema = z.object({}).strip().describe("No input needed");

/**
 * Input schema for the TRNCH Heat feed.
 */
export const GetTrnchHeatSchema = z
  .object({
    since: z
      .string()
      .nullable()
      .describe(
        "nextSince returned by the previous call, to get only new entries. Null on the first call.",
      ),
  })
  .strip();

/**
 * Input schema for a TRNCH buy.
 */
export const TrnchBuySchema = z
  .object({
    tokenId,
    token,
    amountUsd: z
      .number()
      .positive()
      .max(50000)
      .describe("Amount to spend in US dollars, paid in USDG"),
    slippageBps,
  })
  .strip()
  .refine(v => v.tokenId || v.token, { message: "Provide tokenId or token" });

/**
 * Input schema for a TRNCH sell.
 */
export const TrnchSellSchema = z
  .object({
    tokenId,
    token,
    percent: z
      .number()
      .positive()
      .max(100)
      .describe("Share of the wallet balance to sell, 100 = all"),
    slippageBps,
  })
  .strip()
  .refine(v => v.tokenId || v.token, { message: "Provide tokenId or token" });
