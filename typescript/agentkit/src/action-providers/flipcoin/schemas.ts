import { z } from "zod";

/**
 * Schema for listing prediction markets.
 */
export const GetMarketsSchema = z
  .object({
    status: z
      .enum(["active", "expired", "resolved", "all"])
      .nullable()
      .optional()
      .describe("Filter by market status. Defaults to 'active' (tradable markets only)."),
    category: z
      .string()
      .nullable()
      .optional()
      .describe("Optional category filter (e.g. 'crypto', 'sports', 'politics')."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .optional()
      .describe("Maximum number of markets to return (1-100). Default 25."),
    offset: z
      .number()
      .int()
      .min(0)
      .nullable()
      .optional()
      .describe("Number of markets to skip, for pagination. Default 0."),
  })
  .describe("Parameters for listing FlipCoin prediction markets.");

/**
 * Schema for fetching current odds / firm quote for a market.
 */
export const GetMarketOddsSchema = z
  .object({
    conditionId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a 0x-prefixed 32-byte condition id")
      .describe(
        "The market conditionId (0x-prefixed 32-byte hex). Get it from get_prediction_markets.",
      ),
    side: z
      .enum(["yes", "no"])
      .nullable()
      .optional()
      .describe("Outcome side to price. Defaults to 'yes'."),
    action: z
      .enum(["buy", "sell"])
      .nullable()
      .optional()
      .describe("Whether to simulate a buy or sell. Defaults to 'buy'."),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .nullable()
      .optional()
      .describe(
        "Optional human-readable amount used for firm-quote simulation. Interpreted as USDC when action='buy' (e.g. '10' = $10) and as shares when action='sell' (e.g. '10' = 10 shares). Required when you want sharesOut / priceImpact.",
      ),
  })
  .describe("Parameters for fetching market odds / firm quote.");

/**
 * Schema for buying YES or NO shares in a market.
 */
export const BuySharesSchema = z
  .object({
    conditionId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a 0x-prefixed 32-byte condition id")
      .describe("The market conditionId (0x-prefixed 32-byte hex)."),
    side: z.enum(["yes", "no"]).describe("Outcome to buy: 'yes' or 'no'."),
    amountUsdc: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .describe("USDC amount to spend (human units, e.g. '5' = $5)."),
    maxSlippageBps: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .nullable()
      .optional()
      .describe("Maximum slippage tolerance in basis points (10000 = 100%). Defaults to 100 (1%)."),
  })
  .describe("Parameters for buying shares in a FlipCoin prediction market.");

/**
 * Schema for selling YES or NO shares in a market.
 */
export const SellSharesSchema = z
  .object({
    conditionId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a 0x-prefixed 32-byte condition id")
      .describe("The market conditionId (0x-prefixed 32-byte hex)."),
    side: z.enum(["yes", "no"]).describe("Outcome side of the shares being sold."),
    shares: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .describe("Amount of shares to sell (human units, e.g. '10' = 10 shares)."),
    maxSlippageBps: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .nullable()
      .optional()
      .describe("Maximum slippage tolerance in basis points. Defaults to 100 (1%)."),
  })
  .describe("Parameters for selling shares in a FlipCoin prediction market.");

/**
 * Schema for fetching the agent's portfolio. No args required.
 */
export const GetAgentPortfolioSchema = z
  .object({
    status: z
      .enum(["open", "resolved", "all"])
      .nullable()
      .optional()
      .describe("Filter positions by market status. Defaults to 'all'."),
  })
  .describe("Parameters for fetching the current agent's positions and P&L.");
