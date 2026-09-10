import { z } from "zod";

/**
 * Input schema for getting available Floe lending markets.
 */
export const FloeGetMarketsSchema = z
  .object({})
  .describe("Input schema for getting available Floe lending markets");

/**
 * Input schema for instantly borrowing USDC via Floe.
 */
export const FloeInstantBorrowSchema = z
  .object({
    borrowAmount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid number")
      .describe("Amount of USDC to borrow in human-readable format (e.g. '1000' for 1,000 USDC)"),
    collateralAmount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid number")
      .describe("Amount of collateral in human-readable format (e.g. '10000' for 10,000 USDC)"),
    maxInterestRateBps: z
      .string()
      .regex(/^\d+$/, "Must be a whole number")
      .describe("Maximum acceptable annual interest rate in basis points (e.g. '800' for 8%)"),
    duration: z
      .string()
      .regex(/^\d+$/, "Must be a whole number")
      .describe("Loan duration in seconds (e.g. '1209600' for 14 days)"),
    marketId: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/, "Must be a valid hex market ID")
      .optional()
      .describe("Market ID (hex). Defaults to USDC/USDC if omitted"),
  })
  .describe("Input schema for instantly borrowing USDC via Floe");

/**
 * Input schema for repaying a Floe loan.
 */
export const FloeRepaySchema = z
  .object({
    loanId: z.string().describe("The on-chain loan ID to repay"),
    slippageBps: z
      .string()
      .regex(/^\d+$/, "Must be a whole number")
      .optional()
      .describe("Slippage tolerance in basis points (default: 500 = 5%)"),
  })
  .describe("Input schema for repaying a Floe loan");

/**
 * Input schema for checking Floe loan status.
 */
export const FloeCheckStatusSchema = z
  .object({
    loanId: z.string().describe("The on-chain loan ID to check"),
  })
  .describe("Input schema for checking Floe loan status");

/**
 * Input schema for getting agent credit balance from the Floe facilitator.
 */
export const FloeGetBalanceSchema = z
  .object({})
  .describe("Input schema for getting agent credit balance");

/**
 * Input schema for checking Floe loan health.
 */
export const FloeCheckHealthSchema = z
  .object({
    loanId: z.string().describe("The on-chain loan ID to check health for"),
  })
  .describe("Input schema for checking Floe loan health");

/**
 * Input schema for granting credit delegation to the Floe facilitator.
 */
export const FloeGrantDelegationSchema = z
  .object({
    facilitatorAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
      .optional()
      .describe("Floe facilitator address. Defaults to the known address for the current network if omitted."),
    borrowLimit: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid number")
      .describe("Maximum USDC the facilitator can borrow on your behalf (e.g. '10000')"),
    maxRateBps: z
      .string()
      .regex(/^\d+$/, "Must be a whole number")
      .describe("Maximum interest rate cap in basis points (e.g. '1500' for 15%)"),
    expiryDays: z
      .string()
      .regex(/^\d+$/, "Must be a whole number")
      .describe("Delegation duration in days (e.g. '90' for 3 months)"),
  })
  .describe("Input schema for granting credit delegation to the Floe facilitator");

/**
 * Input schema for calling an x402 API via Floe credit.
 */
export const FloeFetchSchema = z
  .object({
    url: z.string().url().describe("The x402-enabled URL to fetch"),
    method: z.string().optional().describe("HTTP method (default: GET)"),
    headers: z.record(z.string()).optional().describe("Additional HTTP headers"),
    body: z.string().optional().describe("Request body (for POST/PUT)"),
  })
  .describe("Input schema for calling an x402 API via Floe credit");
