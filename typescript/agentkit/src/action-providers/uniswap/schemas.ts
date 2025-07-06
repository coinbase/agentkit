import { z } from "zod";

/**
 * Input schema for Uniswap token swap action.
 */
export const SwapSchema = z
  .object({
    tokenIn: z.string().describe("The contract address of the token to swap from"),
    tokenOut: z.string().describe("The contract address of the token to swap to"),
    amount: z.string().describe("The amount of tokenIn to swap (in token units, e.g. '1.5')"),
    slippageTolerance: z
      .number()
      .min(0)
      .max(100)
      .default(0.5)
      .describe("Maximum acceptable slippage percentage (0-100, default: 0.5%)"),
    fee: z
      .number()
      .default(3000)
      .describe("Pool fee tier in hundredths of a bip (default: 3000 = 0.3%)"),
  })
  .strip()
  .describe("Instructions for swapping tokens on Uniswap V3");

/**
 * Input schema for getting a quote for a Uniswap swap.
 */
export const QuoteSchema = z
  .object({
    tokenIn: z.string().describe("The contract address of the token to swap from"),
    tokenOut: z.string().describe("The contract address of the token to swap to"),
    amount: z.string().describe("The amount of tokenIn to quote (in token units, e.g. '1.5')"),
    fee: z
      .number()
      .default(3000)
      .describe("Pool fee tier in hundredths of a bip (default: 3000 = 0.3%)"),
  })
  .strip()
  .describe("Instructions for getting a quote for a Uniswap V3 swap"); 