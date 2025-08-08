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
    fromAssetId: z.string().describe("The asset ID to swap from (e.g., 'eth', 'usdc')"),
    toAssetId: z.string().describe("The asset ID to swap to (e.g., 'eth', 'usdc')"),
    amount: z.string().describe("The amount to swap (in the from asset's units)"),
    network: z
      .string()
      .optional()
      .describe("The network to perform the swap on (defaults to wallet's network)"),
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
