import { z } from "zod";

/**
 * Input schema for executing a low-fee token swap on Base L2 via Santa Rosa Router.
 */
export const SwapSchema = z
  .object({
    tokenIn: z
      .string()
      .describe("Input token symbol or address on Base (e.g. 'USDC', 'WETH', 'cbBTC')."),
    tokenOut: z
      .string()
      .describe("Output token symbol or address on Base to receive."),
    amountIn: z
      .string()
      .describe("Amount of tokenIn to swap in atomic units or decimal string."),
    slippageToleranceBps: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum slippage in basis points (default: 50 = 0.50%)."),
    referralAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("Builder referral address to receive 0.01% instant revenue share on Base L2."),
  })
  .describe("Input schema for executing a token swap on Base L2 with ultra-low 0.03% fee");

/**
 * Input schema for quoting leverage multiply plan via Morpho Blue 0% flash loan.
 */
export const QuoteLeverageMultiplySchema = z
  .object({
    flashLoanAmountUsd: z
      .number()
      .positive()
      .describe("Flash loan capital amount in USD needed to multiply exposure."),
    leverageMultiplier: z
      .number()
      .min(1.1)
      .max(10.0)
      .describe("Target leverage multiplier (e.g. 2.5 for 2.5x)."),
    referralAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("Builder referral address to receive 0.02% revenue share on flash leverage volume."),
  })
  .describe("Input schema for quoting 1-click leverage multiply plan");

/**
 * Input schema for inspecting a user's debt positions on Base L2.
 */
export const GetUserDebtPositionsSchema = z
  .object({
    userAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The EVM wallet or vault address to inspect for active debt and collateral on Morpho Base."),
  })
  .describe("Input schema for inspecting user debt positions on Base L2");

/**
 * Input schema for simulating debt rescue savings.
 */
export const SimulateRescueSavingsSchema = z
  .object({
    userAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The borrower address on Base whose position is near liquidation."),
    currentDebtUsd: z
      .number()
      .positive()
      .describe("Total current debt amount in USD."),
    debtToRepayUsd: z
      .number()
      .positive()
      .describe("Amount of debt in USD to deleverage/repay using a 0% flash loan."),
    referralAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("Builder referral address to receive the 0.05% revenue share on Base L2."),
  })
  .describe("Input schema for simulating anti-liquidation rescue savings");

/**
 * Input schema for building executable rescue transaction calldata.
 */
export const BuildRescueTransactionSchema = z
  .object({
    loanToken: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The underlying debt token address on Base (e.g., USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)."),
    loanAmountWei: z
      .string()
      .regex(/^\d+$/, "Must be a valid integer string representing amount in atomic units (wei)")
      .describe("The loan amount in atomic units (wei) to flash borrow and repay."),
    referralAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("Builder referral address to receive 0.05% fee share directly in the same execution block."),
  })
  .describe("Input schema for building atomic rescue transaction calldata on Base L2");
