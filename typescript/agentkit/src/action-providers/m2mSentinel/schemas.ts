import { z } from "zod";

/**
 * Input schema for auditing a smart contract on Base.
 */
export const AuditContractSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address format (must be 0x followed by 40 hex characters)")
      .describe("Target Base mainnet smart contract address to inspect"),
  })
  .strip()
  .describe("Instructions for auditing a contract on Base");

/**
 * Input schema for getting real-time Base network gas execution metrics.
 */
export const GetGasMetricsSchema = z
  .object({})
  .strip()
  .describe("Instructions for getting Base network gas metrics");

/**
 * Input schema for retrieving Base DEX token prices.
 */
export const GetTokenPriceSchema = z
  .object({
    symbol: z
      .string()
      .min(1, "Token symbol is required")
      .describe("Token symbol on Base (e.g. USDC, WETH, cbBTC)"),
  })
  .strip()
  .describe("Instructions for retrieving Base token prices");

/**
 * Input schema for retrieving M2M Sentinel service status.
 */
export const GetServiceStatusSchema = z
  .object({})
  .strip()
  .describe("Instructions for retrieving M2M Sentinel service operational status");

/**
 * Configuration options for M2MSentinelActionProvider.
 */
export const M2MSentinelConfigSchema = z
  .object({
    baseUrl: z.string().url().optional().describe("Custom M2M Sentinel base URL"),
    apiKey: z.string().optional().describe("Optional M2M Sentinel API key for authenticated quota"),
  })
  .optional();

export type M2MSentinelConfig = z.infer<typeof M2MSentinelConfigSchema>;
