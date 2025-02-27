import { z } from "zod";

/**
 * Input schema for supply action.
 */
export const SupplySchema = z
  .object({
    chain: z.string().describe("The chain to supply on (e.g. base-mainnet)"),
    amount: z.string().describe("The amount to supply"),
    asset: z.string().describe("The asset to supply (e.g. ETH, USDC)"),
  })
  .strip()
  .describe("Instructions for supplying assets to Aave");

/**
 * Input schema for withdraw action.
 */
export const WithdrawSchema = z
  .object({
    chain: z.string().describe("The chain to withdraw from (e.g. base-mainnet)"),
    amount: z.string().describe("The amount to withdraw"),
    asset: z.string().describe("The asset to withdraw (e.g. ETH, USDC)"),
  })
  .strip()
  .describe("Instructions for withdrawing assets from Aave");
