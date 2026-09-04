import { z } from "zod";

/**
 * Input schema for scouting new Base tokens.
 */
export const ScoutNewTokensSchema = z
  .object({
    minLiquidity: z
      .number()
      .min(0)
      .optional()
      .describe("Liquidity floor in USD for new pools (default 15000)"),
    pools: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe("How many of the top new pools to safety-check (default 3)"),
  })
  .strip()
  .describe("Input schema for scouting new Base tokens with safety verdicts");

/**
 * Input schema for checking a Base token's safety.
 */
export const TokenSafetySchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x-prefixed 40-hex-character address")
      .describe("Token contract address on Base"),
  })
  .strip()
  .describe("Input schema for token safety checks");

/**
 * Input schema for reading a Base wallet portfolio.
 */
export const PortfolioSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x-prefixed 40-hex-character address")
      .describe("Wallet address on Base"),
    minValue: z
      .number()
      .min(0)
      .optional()
      .describe("USD floor per holding, filters airdropped spam (default 1)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("How many holdings to list, largest first (default 20)"),
  })
  .strip()
  .describe("Input schema for wallet portfolio valuation");

/**
 * Input schema for pricing a Base token by contract address.
 */
export const TokenPriceSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x-prefixed 40-hex-character address")
      .describe("Token contract address on Base"),
  })
  .strip()
  .describe("Input schema for onchain token pricing");

/**
 * Input schema for Basename resolution.
 */
export const BasenameSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .max(255)
      .describe(
        "A basename (e.g. 'jesse.base.eth' — the .base.eth suffix is optional) or a 0x address to reverse-resolve",
      ),
  })
  .strip()
  .describe("Input schema for Basename resolution");

/**
 * Input schema for the one-call market brief.
 */
export const MarketBriefSchema = z
  .object({
    symbols: z
      .array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,31}$/))
      .max(6)
      .optional()
      .describe("Tickers or CoinGecko ids to price instead of the default BTC/ETH/SOL, up to 6"),
  })
  .strip()
  .describe("Input schema for the market brief");
