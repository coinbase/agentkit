import { z } from "zod";

/**
 * Input schema for Yelay Vault deposit action.
 */
export const YelayDepositSchema = z
  .object({
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The quantity of assets to deposit"),
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The vault address which will receive the shares"),
  })
  .describe("Input schema for Yelay Vault deposit action");

/**
 * Input schema for Yelay Vault redeem action.
 */
export const YelayRedeemSchema = z
  .object({
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of assets to redeem"),
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The vault address from which will redeem the shares"),
  })
  .strip()
  .describe("Input schema for Yelay Vault redeem action");

/**
 * Input schema for Yelay Vault claim action.
 */
export const YelayClaimSchema = z
  .object({
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The vault address from which will claim yield"),
  })
  .strip()
  .describe("Input schema for Yelay Vault claim action");

/**
 * Input schema for Yelay Vault balance action.
 */
export const YelayBalanceSchema = z
  .object({
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The vault address where deposit was made"),
  })
  .strip()
  .describe("Input schema for Yelay Vault balance action");
