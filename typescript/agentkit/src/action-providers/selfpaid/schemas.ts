import { z } from "zod";
import { SELFPAID_PROTOCOLS, SELFPAID_REDEEM_PROTOCOLS } from "./constants";

/**
 * Input schema for check_yield_rates action.
 */
export const CheckYieldRatesSchema = z
  .object({})
  .strip()
  .describe("No parameters required to fetch live USDC yield rates on Base Mainnet");

/**
 * Input schema for quote_zero_cost_payment action.
 */
export const QuoteZeroCostPaymentSchema = z
  .object({
    amount: z
      .number()
      .positive()
      .describe("USDC amount to pay to the recipient (e.g. 5.0, 25.0)"),
    protocol: z
      .enum(SELFPAID_PROTOCOLS)
      .optional()
      .default("auto")
      .describe('DeFi yield protocol: "auto" selects highest APY, or explicitly "aave" / "morpho"'),
    collateralMultiplier: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(3)
      .describe("Collateral multiplier (e.g. 3 for 3x compact, 5 for 5x, 10 for 10x). Defaults to 3"),
    bufferPercentage: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe("Safety buffer percentage against APY fluctuation (defaults to 3%)"),
  })
  .strip()
  .describe("Parameters for quoting a zero-net-cost USDC payment on Base Mainnet");

/**
 * Input schema for prepare_zero_cost_payment action.
 */
export const PrepareZeroCostPaymentSchema = z
  .object({
    recipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 40-character hexadecimal EVM address on Base (0x...)")
      .describe("Recipient wallet or contract address on Base"),
    amount: z
      .number()
      .positive()
      .describe("USDC amount to pay to the recipient"),
    protocol: z
      .enum(SELFPAID_PROTOCOLS)
      .optional()
      .default("auto")
      .describe('DeFi protocol: "auto", "aave", or "morpho"'),
    collateralMultiplier: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(3)
      .describe("Collateral multiplier (defaults to 3x)"),
    bufferPercentage: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe("Buffer percentage (defaults to 3%)"),
  })
  .strip()
  .describe("Parameters for preparing a 4-call atomic zero-cost payment batch on Base");

/**
 * Input schema for send_zero_cost_payment action.
 */
export const SendZeroCostPaymentSchema = z
  .object({
    recipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 40-character hexadecimal EVM address on Base (0x...)")
      .describe("Recipient address on Base to receive the USDC payment"),
    amount: z
      .number()
      .positive()
      .describe("USDC amount to pay to the recipient"),
    protocol: z
      .enum(SELFPAID_PROTOCOLS)
      .optional()
      .default("auto")
      .describe('DeFi protocol: "auto", "aave", or "morpho"'),
    collateralMultiplier: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(3)
      .describe("Collateral multiplier (defaults to 3x)"),
    bufferPercentage: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe("Buffer percentage (defaults to 3%)"),
  })
  .strip()
  .describe("Parameters for executing a zero-net-cost USDC payment on Base Mainnet");

/**
 * Input schema for get_treasury_status action.
 */
export const GetTreasuryStatusSchema = z
  .object({
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM address")
      .optional()
      .describe("Wallet or treasury address to inspect. Defaults to the agent wallet address"),
  })
  .strip()
  .describe("Parameters for inspecting SelfPaidPal yield collateral and treasury status on Base");

/**
 * Input schema for redeem_collateral action.
 */
export const RedeemCollateralSchema = z
  .object({
    protocol: z
      .enum(SELFPAID_REDEEM_PROTOCOLS)
      .describe('Protocol to redeem collateral from: "aave" or "morpho"'),
    amount: z
      .number()
      .positive()
      .optional()
      .describe("USDC amount of collateral to withdraw. If omitted, withdraws maximum available balance"),
    execute: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, executes the withdrawal transaction immediately on-chain. If false, returns prepared calldata"),
  })
  .strip()
  .describe("Parameters for redeeming yield-bearing collateral back to liquid USDC on Base");

/**
 * Configuration options for SelfPaidActionProvider.
 */
export interface SelfPaidConfig {
  /** Optional custom SelfPaidPal API endpoint override. */
  apiUrl?: string;
}
