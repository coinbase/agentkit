import { z } from "zod";

export const GetSwapQuoteSchema = z
  .object({
    sellToken: z
      .string()
      .describe(
        "ERC-20 contract address of the token to sell on Base mainnet. " +
          "Example USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ),
    buyToken: z
      .string()
      .describe(
        "ERC-20 contract address of the token to buy on Base mainnet. " +
          "Example WETH: 0x4200000000000000000000000000000000000006",
      ),
    sellAmount: z
      .string()
      .describe(
        "Amount to sell in the token's smallest unit (base decimals). " +
          "Example: '1000000' = 1 USDC (6 decimals), '1000000000000000000' = 1 WETH (18 decimals).",
      ),
    tier: z
      .enum(["basic", "resilient", "institutional"])
      .default("basic")
      .describe(
        "Execution tier. " +
          "basic ($0.03): direct 0x route. " +
          "resilient ($0.10): dual-lane concurrent race — 0x/ParaSwap vs Aerodrome. " +
          "institutional ($0.50): race + Uniswap V3 safety net.",
      ),
    slippagePercentage: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Maximum acceptable slippage as a decimal fraction. Example: 0.01 = 1%."),
  })
  .strip();
