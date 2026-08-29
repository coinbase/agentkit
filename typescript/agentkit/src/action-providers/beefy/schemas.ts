import { z } from "zod";

const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

const positiveAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value");

/**
 * Input schema for depositing into a Beefy vault.
 */
export const BeefyDepositSchema = z
  .object({
    vaultAddress: ethAddress.describe(
      "The Beefy vault contract address (earnContractAddress from the API)",
    ),
    amount: positiveAmount.describe(
      "The amount of the underlying 'want' token to deposit, in whole units",
    ),
  })
  .describe("Deposit tokens into a Beefy auto-compounding vault to earn yield");

/**
 * Input schema for withdrawing from a Beefy vault.
 */
export const BeefyWithdrawSchema = z
  .object({
    vaultAddress: ethAddress.describe("The Beefy vault contract address to withdraw from"),
    amount: positiveAmount
      .optional()
      .describe(
        "Amount of mooTokens (vault shares) to withdraw in whole units. Leave empty to withdraw all",
      ),
  })
  .describe("Withdraw tokens from a Beefy vault back to the underlying want token");

/**
 * Input schema for checking a vault position.
 */
export const CheckPositionSchema = z
  .object({
    vaultAddress: ethAddress.describe("The Beefy vault contract address to check"),
  })
  .describe("Check your position in a Beefy vault — balance, share value, and underlying worth");

/**
 * Input schema for listing Beefy vaults.
 */
export const ListVaultsSchema = z
  .object({
    platform: z
      .string()
      .optional()
      .describe(
        "Filter by platform (e.g., 'aerodrome', 'morpho', 'curve'). Leave empty for all",
      ),
  })
  .describe("List active Beefy vaults on Base with APYs and TVL, sorted by TVL");
