import { z } from "zod";

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

/**
 * Input schema for getting a HelmSwap quote and for executing a HelmSwap swap.
 */
export const HelmswapQuoteSchema = z
  .object({
    sellToken: evmAddress.describe(
      "The token contract address to sell. Use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for the native asset.",
    ),
    buyToken: evmAddress.describe(
      "The token contract address to buy. Use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for the native asset.",
    ),
    sellAmount: z
      .string()
      .regex(/^\d*\.?\d+$/, "Amount must be a valid decimal number")
      .describe("The amount of sellToken to sell in whole units (e.g., 1.5 WETH, 10 USDC)"),
    slippageBps: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .nullable()
      .transform(val => val ?? 50)
      .describe("The maximum acceptable slippage in basis points (1-1000, default: 50)"),
  })
  .strip()
  .describe("Parameters for a HelmSwap quote or swap");

export const HelmswapSwapSchema = HelmswapQuoteSchema;
