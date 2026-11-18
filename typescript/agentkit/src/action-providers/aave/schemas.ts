import { z } from "zod";

/**
 * Input schema for Aave V3 supply action.
 */
export const SupplySchema = z
  .object({
    assetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the underlying ERC-20 asset to supply (e.g. USDC)"),
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of assets to supply, in whole units"),
    onBehalfOf: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe(
        "The address that will receive the aTokens and own the supplied position — usually the wallet's own address",
      ),
  })
  .strip()
  .describe("Input schema for Aave V3 supply action");

/**
 * Input schema for Aave V3 withdraw action.
 */
export const WithdrawSchema = z
  .object({
    assetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the underlying ERC-20 asset to withdraw (e.g. USDC)"),
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe(
        "The amount of assets to withdraw, in whole units. Aave treats an amount greater than the supplied balance as a request to withdraw the entire balance.",
      ),
    to: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address that will receive the withdrawn assets"),
  })
  .strip()
  .describe("Input schema for Aave V3 withdraw action");
