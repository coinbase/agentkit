import { z } from "zod";

/**
 * Schema for the get_wallet_details action.
 * This action doesn't require any input parameters, so we use an empty object schema.
 */
export const GetWalletDetailsSchema = z.object({});

/**
 * Input schema for native transfer action.
 */
export const NativeTransferSchema = z
  .object({
    to: z.string().describe("The destination address to receive the funds"),
    value: z.string().describe("The amount to transfer in whole units e.g. 1 ETH or 0.00001 ETH"),
  })
  .strip()
  .describe("Instructions for transferring native tokens");
