import { z } from "zod";

const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

const WholeAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value");

/**
 * Input schema for Sapien Vault deposit action.
 */
export const SapienVaultDepositSchema = z
  .object({
    assets: WholeAmountSchema.describe("The quantity of SAPIEN to deposit, in whole units"),
    receiver: EthereumAddressSchema.optional().describe(
      "The address that will receive vSAPIEN shares. Defaults to the connected wallet.",
    ),
  })
  .describe("Input schema for Sapien Vault deposit action");

/**
 * Input schema for Sapien Vault withdraw action (assets in).
 */
export const SapienVaultWithdrawSchema = z
  .object({
    assets: WholeAmountSchema.describe("The quantity of SAPIEN to withdraw, in whole units"),
    receiver: EthereumAddressSchema.optional().describe(
      "The address that will receive SAPIEN. Defaults to the connected wallet.",
    ),
  })
  .describe("Input schema for Sapien Vault withdraw action");

/**
 * Input schema for Sapien Vault redeem action (shares in).
 */
export const SapienVaultRedeemSchema = z
  .object({
    shares: WholeAmountSchema.describe("The quantity of vSAPIEN shares to redeem, in whole units"),
    receiver: EthereumAddressSchema.optional().describe(
      "The address that will receive SAPIEN. Defaults to the connected wallet.",
    ),
  })
  .describe("Input schema for Sapien Vault redeem action");

/**
 * Input schema for Sapien Vault position / tranche read.
 */
export const SapienVaultGetPositionSchema = z
  .object({
    address: EthereumAddressSchema.optional().describe(
      "The address to read. Defaults to the connected wallet.",
    ),
  })
  .describe("Input schema for Sapien Vault position read");

/**
 * Input schema for Sapien Vault totals read (no parameters).
 */
export const SapienVaultGetVaultTotalsSchema = z
  .object({})
  .describe("Input schema for Sapien Vault totals read");

/**
 * Input schema for transferring vSAPIEN shares.
 */
export const SapienVaultTransferSchema = z
  .object({
    destination: EthereumAddressSchema.describe("The address that will receive vSAPIEN shares"),
    shares: WholeAmountSchema.describe(
      "The quantity of vSAPIEN shares to transfer, in whole units",
    ),
  })
  .describe("Input schema for Sapien Vault share transfer");
