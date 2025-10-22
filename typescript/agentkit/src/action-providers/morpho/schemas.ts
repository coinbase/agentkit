import { z } from "zod";

/**
 * Input schema for Morpho Vault deposit action.
 */
export const DepositSchema = z
  .object({
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The quantity of assets to deposit, in whole units"),
    receiver: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe(
        "The address that will own the position on the vault which will receive the shares",
      ),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the assets token to approve for deposit"),
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the Morpho Vault to deposit to"),
  })
  .describe("Input schema for Morpho Vault deposit action");

/**
 * Input schema for Morpho Vault withdraw action.
 */
export const WithdrawSchema = z
  .object({
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the Morpho Vault to withdraw from"),
    assets: z
      .string()
      .regex(/^\d+$/, "Must be a valid whole number")
      .describe("The amount of assets to withdraw in atomic units e.g. 1"),
    receiver: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address to receive the shares"),
  })
  .strip()
  .describe("Input schema for Morpho Vault withdraw action");
