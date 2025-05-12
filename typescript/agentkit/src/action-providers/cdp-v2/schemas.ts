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
