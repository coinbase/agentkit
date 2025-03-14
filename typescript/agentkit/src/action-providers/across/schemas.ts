import { z } from "zod";

/**
 * Input schema for bridge token action.
 */
export const BridgeTokenSchema = z
  .object({
    destinationChainId: z
      .string()
      .describe("The chain ID of the destination chain (e.g. 11155111 for base-sepolia)"),
    inputTokenSymbol: z
      .string()
      .describe("The symbol of the token to bridge (e.g., 'ETH', 'WETH', 'USDC')")
      .default("ETH"),
    amount: z
      .string()
      .describe("The amount of tokens to bridge in whole units (e.g. 1.5 WETH, 10 USDC)"),
    recipient: z
      .string()
      .optional()
      .describe("The recipient address on the destination chain (defaults to sender)"),
    maxSplippage: z
      .number()
      .optional()
      .describe("The maximum slippage percentage (e.g. 10 for 10%)")
      .default(1.5),
  })
  .strip()
  .describe("Instructions for bridging tokens across chains using Across Protocol");
