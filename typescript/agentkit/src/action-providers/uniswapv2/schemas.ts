import { z } from "zod";

/**
 * Action schemas for the uniswapv2 action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the uniswapv2 action provider.
 */

/**
 * Schema for the ETH to USDC swap action.
 *
 * This schema defines the parameters required to perform a swap from ETH to USDC
 * via the Uniswap V2 protocol on Base Sepolia network.
 */
export const SwapEthToUsdcSchema = z.object({
  /**
   * The amount of ETH to swap
   * Must be a valid number greater than 0
   */
  ethAmount: z.number().positive().describe("Amount of ETH to swap"),

  /**
   * The slippage percentage (e.g. 0.5 for 0.5%)
   * Must be a valid number between 0 and 50
   */
  slippagePercent: z
    .number()
    .min(0)
    .max(50)
    .default(1)
    .describe("Slippage percentage (default: 1%)"),

  /**
   * Deadline in minutes for the transaction (optional, defaults to 20 minutes)
   * Values between 1 and 60 minutes are accepted
   */
  deadlineMinutes: z.number().min(1).max(60).default(20).optional(),
});
