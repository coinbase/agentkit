import { z } from "zod";
import { SUPPORTED_NETWORKS } from "@vaultsfyi/sdk";

/**
 * Action schemas for the vaultsfyi action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the vaultsfyi action provider.
 */

const NetworkSchema = z.enum(SUPPORTED_NETWORKS);

/**
 * Vaults list action schema.
 */
export const VaultsActionSchema = z.object({
  allowedAssets: z
    .array(z.string())
    .optional()
    .describe("Optional: Symbols of the assets to filter vaults by"),
  allowedProtocols: z
    .array(z.string())
    .optional()
    .describe("Optional: Protocols to filter vaults by. Leave undefined to include all protocols."),
  allowedNetworks: z
    .array(NetworkSchema)
    .optional()
    .describe("Optional: Networks to filter vaults by. Leave undefined to include all networks."),
  minTvl: z.coerce.number().optional().describe("Optional: Minimum TVL to filter vaults by"),
  sort: z
    .object({
      field: z.enum(["tvl", "apy1day", "apy7day", "apy30day"]).optional().describe("Sort field"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    })
    .optional()
    .describe("Sort options"),
  perPage: z.coerce
    .number()
    .optional()
    .describe("Optional: Number of results per page (default: 5)"),
  page: z.coerce.number().optional().describe("Optional: Page number starting from 0 (default: 0)"),
});

/**
 * Vault details action schema.
 */
export const VaultDetailsActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to fetch details for"),
  network: NetworkSchema.describe("The network of the vault"),
});

export const VaultHistoricalDataActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to fetch historical data for"),
  network: NetworkSchema.describe("The network of the vault"),
  fromDate: z.string().datetime().describe("The date to fetch historical data from"),
  toDate: z.string().datetime().describe("The date to fetch historical data to"),
  granularity: z.enum(["1hour", "1day", "1week"]).describe("The granularity of the data"),
  apyInterval: z.enum(["1day", "7day", "30day"]).describe("The interval of the apy data"),
  page: z.coerce.number().optional().describe("The page number to fetch"),
  perPage: z.coerce.number().optional().describe("The number of results per page"),
});

/**
 * Base transaction params schema.
 */
export const transactionContextActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to interact with"),
  network: NetworkSchema.describe("The network of the vault"),
});

export const executeStepActionSchema = transactionContextActionSchema.extend({
  action: z
    .enum([
      "deposit",
      "redeem",
      "request-redeem",
      "request-deposit",
      "claim-redeem",
      "claim-deposit",
      "claim-rewards",
      "start-redeem-cooldown",
    ])
    .describe("The action to execute"),
  assetAddress: z.string().describe("The address of the vault's underlying token"),
  amount: z.coerce
    .bigint()
    .or(z.literal("all"))
    .optional()
    .describe("The amount of assets to use as a number with decimals"),
});

export const claimRewardsActionSchema = z.object({
  claimIds: z.array(z.string()).describe("The ids of the rewards to claim"),
});

export const benchmarkActionSchema = z.object({
  network: NetworkSchema.describe("The network to retrieve benchmark data for"),
  benchmarkCode: z.enum(["eth", "usd"]).describe("The benchmark code to retrieve data for"),
});

export const historicalBenchmarkActionSchema = benchmarkActionSchema.extend({
  fromDate: z.string().datetime().describe("The date to fetch historical data from"),
  toDate: z.string().datetime().describe("The date to fetch historical data to"),
  page: z.coerce.number().optional().describe("The page number to fetch"),
  perPage: z.coerce.number().optional().describe("The number of results per page"),
});

export const totalVaultReturnsActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to fetch total returns for"),
  userAddress: z
    .string()
    .optional()
    .describe("The address of the user to fetch total returns for. (default: user's address)"),
  network: NetworkSchema.describe("The network of the vault"),
});

export const userEventsActionSchema = z.object({
  vaultAddress: z.string().describe("The address of the vault to fetch user events for"),
  userAddress: z
    .string()
    .optional()
    .describe("The address of the user to fetch user events for. (default: user's address)"),
  network: NetworkSchema.describe("The network of the vault"),
});
