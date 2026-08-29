import { z } from "zod";

/**
 * Input schema for staking ETH to receive wstETH via Lido on Base.
 */
export const StakeSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of ETH to stake, in whole units (e.g., '0.1' for 0.1 ETH)"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.1)
      .default(0.005)
      .describe("Slippage tolerance for minimum wstETH received (default 0.005 = 0.5%)"),
  })
  .describe(
    "Stake ETH to receive wstETH on Base via Lido Direct Staking (Chainlink CCIP fast stake)",
  );

/**
 * Input schema for staking WETH to receive wstETH via Lido on Base.
 */
export const StakeWethSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of WETH to stake, in whole units (e.g., '0.1' for 0.1 WETH)"),
    slippage: z
      .number()
      .min(0.001)
      .max(0.1)
      .default(0.005)
      .describe("Slippage tolerance for minimum wstETH received (default 0.005 = 0.5%)"),
  })
  .describe("Stake WETH to receive wstETH on Base via Lido Direct Staking");

/**
 * Input schema for checking wstETH balance.
 */
export const CheckBalanceSchema = z
  .object({})
  .describe("Check the current wstETH balance of the connected wallet on Base");
