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
      .describe("The amount of fromToken to sell in whole units (e.g., 1.5 WETH, 10.5 USDC)"),
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

/**
 * Input schema for listing spend permissions action.
 */
export const ListSpendPermissionsSchema = z
  .object({
    smartAccountAddress: z
      .string()
      .describe("The smart account address that has granted spend permissions"),
    network: z
      .string()
      .optional()
      .describe("The network to list permissions on (defaults to wallet's network)"),
  })
  .strip()
  .describe("Instructions for listing spend permissions for a smart account");

/**
 * Input schema for using a spend permission action.
 */
export const UseSpendPermissionSchema = z
  .object({
    smartAccountAddress: z
      .string()
      .describe("The smart account address that has granted the spend permission"),
    value: z.string().describe("The amount to spend (in the token's units)"),
    network: z
      .string()
      .optional()
      .describe("The network to perform the spend on (defaults to wallet's network)"),
  })
  .strip()
  .describe("Instructions for using a spend permission");

/**
 * Input schema for querying the CDP SQL API
 */
export const CdpSqlApiSchema = z.object({
  sqlQuery: z
    .string()
    .min(1, "SQL query cannot be empty")
    .max(10000, "Query exceeds maximum length of 10,000 characters")
    .describe(
      `The SQL query to execute using ClickHouse syntax. Must be a read-only SELECT statement. ` +
        `Limitations: max 10,000 characters, max 5 JOINs, no cartesian products, 30s timeout. API supports a max of 10,000 result rows but limit it to 10 unless otherwise specified.`,
    ),
});
