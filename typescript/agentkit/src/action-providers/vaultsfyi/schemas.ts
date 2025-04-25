import { z } from "zod";
import { VAULTSFYI_SUPPORTED_CHAINS } from "./constants";

/**
 * Action schemas for the vaultsfyi action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the vaultsfyi action provider.
 */

const NetworkSchema = z.enum(Object.values(VAULTSFYI_SUPPORTED_CHAINS) as [string, ...string[]]);

/**
 * Vaults list action schema.
 */
export const VaultsActionSchema = z.object({
  token: z
    .string()
    .optional()
    .describe("Optional: Name or symbol of the token to filter vaults by"),
  protocol: z.string().optional().describe("Optional: Protocol to filter vaults by"),
  network: NetworkSchema.optional().describe(
    "Optional: Network name to filter vaults by. Supported networks: mainnet, arbitrum, optimism, polygon, base, gnosis, unichain",
  ),
  minTvl: z.number().optional().describe("Optional: Minimum TVL to filter vaults by"),
  sort: z
    .object({
      field: z.enum(["tvl", "apy", "name"]).optional().describe("Sort field"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    })
    .optional()
    .describe("Sort options"),
  take: z.number().optional().describe("Optional: Limit the number of results"),
  page: z.number().optional().describe("Optional: Page number"),
});

/**
 * Base transaction params schema.
 */
const TransactionActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to interact with"),
  assetAddress: z.string().describe("The address of the vault's underlying token"),
  network: NetworkSchema.describe("The network of the vault"),
  amount: z.number().describe("The amount of assets to use"),
});

export const depositActionSchema = TransactionActionSchema;
export const redeemActionSchema = TransactionActionSchema.extend({
  all: z.boolean().optional().describe("Should redeem all assets"),
});
export const claimActionSchema = TransactionActionSchema.omit({
  amount: true,
});
