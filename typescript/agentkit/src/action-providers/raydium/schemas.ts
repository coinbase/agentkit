import { z } from "zod";

/**
 * Schema for getting available Raydium liquidity pools.
 */
export const GetPoolsSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe("Maximum number of pools to return"),
  })
  .describe("Get list of available Raydium liquidity pools");

/**
 * Schema for getting token price from Raydium.
 */
export const GetPriceSchema = z
  .object({
    tokenAMint: z.string().describe("The mint address of the first token"),
    tokenBMint: z.string().describe("The mint address of the second token"),
  })
  .describe("Get current price for a token pair on Raydium");

/**
 * Schema for swapping tokens on Raydium.
 */
export const SwapTokenSchema = z
  .object({
    inputMint: z.string().describe("The mint address of the token to swap from"),
    outputMint: z.string().describe("The mint address of the token to swap to"),
    amount: z.number().positive().describe("Amount of tokens to swap"),
    slippageBps: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe("Slippage tolerance in basis points (e.g., 50 = 0.5%)"),
  })
  .describe("Swap tokens using Raydium DEX");

/**
 * Schema for getting detailed pool information.
 */
export const GetPoolInfoSchema = z
  .object({
    poolId: z.string().describe("The Raydium pool ID (public key)"),
  })
  .describe("Get detailed information about a specific Raydium liquidity pool");

