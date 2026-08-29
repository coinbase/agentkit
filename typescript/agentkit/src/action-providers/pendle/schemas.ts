import { z } from "zod";

const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

const positiveAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value");

/**
 * Input schema for buying PT (Principal Token) on Pendle.
 */
export const BuyPtSchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to trade on"),
    tokenIn: ethAddress.describe(
      "The address of the input token (e.g., WETH, USDC). Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of input tokens to swap, in whole units (e.g., '0.1' for 0.1 WETH)"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Buy PT (Principal Token) on Pendle to lock in a fixed yield until maturity");

/**
 * Input schema for selling PT back to a token.
 */
export const SellPtSchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to trade on"),
    tokenOut: ethAddress.describe(
      "The address of the output token to receive. Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of PT tokens to sell, in whole units"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Sell PT (Principal Token) on Pendle back to an underlying token");

/**
 * Input schema for buying YT (Yield Token) on Pendle.
 */
export const BuyYtSchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to trade on"),
    tokenIn: ethAddress.describe(
      "The address of the input token. Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of input tokens to swap, in whole units"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Buy YT (Yield Token) on Pendle to speculate on yield increases");

/**
 * Input schema for selling YT back to a token.
 */
export const SellYtSchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to trade on"),
    tokenOut: ethAddress.describe(
      "The address of the output token to receive. Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of YT tokens to sell, in whole units"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Sell YT (Yield Token) on Pendle back to an underlying token");

/**
 * Input schema for adding liquidity to a Pendle market.
 */
export const AddLiquiditySchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to provide liquidity to"),
    tokenIn: ethAddress.describe(
      "The address of the input token. Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of tokens to add as liquidity, in whole units"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Add liquidity to a Pendle market to earn swap fees and PENDLE rewards");

/**
 * Input schema for removing liquidity from a Pendle market.
 */
export const RemoveLiquiditySchema = z
  .object({
    market: ethAddress.describe("The Pendle market address to remove liquidity from"),
    tokenOut: ethAddress.describe(
      "The address of the output token to receive. Use 0x0000000000000000000000000000000000000000 for native ETH",
    ),
    amount: positiveAmount.describe("The amount of LP tokens to remove, in whole units"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.5)
      .default(0.01)
      .describe("Slippage tolerance as a decimal (e.g., 0.01 for 1%). Default: 0.01"),
  })
  .describe("Remove liquidity from a Pendle market back to a single token");

/**
 * Input schema for claiming rewards from Pendle positions.
 */
export const ClaimRewardsSchema = z
  .object({
    syAddresses: z
      .array(ethAddress)
      .default([])
      .describe("SY token addresses to claim interest from"),
    ytAddresses: z
      .array(ethAddress)
      .default([])
      .describe("YT token addresses to claim yield from"),
    marketAddresses: z
      .array(ethAddress)
      .default([])
      .describe("Market (LP) addresses to claim rewards from"),
  })
  .describe("Claim accrued interest, yield, and rewards from Pendle positions");

/**
 * Input schema for listing available Pendle markets.
 */
export const ListMarketsSchema = z
  .object({})
  .describe("List active Pendle markets on Base with their APYs, TVL, and maturity dates");
