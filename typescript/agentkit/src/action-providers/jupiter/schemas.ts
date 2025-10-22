import { z } from "zod";

/**
 * Schema for swapping tokens using Jupiter.
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
  .describe("Swap tokens using Jupiter DEX aggregator");
