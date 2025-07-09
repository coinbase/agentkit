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
