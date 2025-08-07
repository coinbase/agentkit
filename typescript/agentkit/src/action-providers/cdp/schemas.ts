import { z } from "zod";

/**
 * Input schema for request faucet funds action.
 */
export const RequestFaucetFundsV2Schema = z
  .object({
    assetId: z.string().optional().describe("The optional asset ID to request from faucet"),
  })
  .strip()
  .describe("Instructions for requesting faucet funds");

/**
 * Input schema for swap tokens action.
 */
export const SwapSchema = z
  .object({
    fromToken: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The token contract address to swap from"),
    toToken: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The token contract address to swap to"),
    fromAmount: z
      .string()
      .describe("The amount of fromToken to sell in whole units (e.g., 1.5 WETH, 10 USDC)"),
    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .optional()
      .default(100)
      .describe("The maximum acceptable slippage in basis points (0-10000, default: 100 = 1%)"),
  })
  .strip()
  .describe("Instructions for swapping tokens");
