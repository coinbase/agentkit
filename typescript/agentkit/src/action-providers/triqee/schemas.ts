import { z } from "zod";

/**
 * Input schema for fetching Tokyo CEX vs Base DEX lead-lag divergence.
 */
export const GetLeadLagDivergenceSchema = z.object({
  pair: z.string().optional().describe("Asset pair to inspect (e.g., 'cbBTC/USDC', 'WETH/USDC', 'cbETH/WETH'). Defaults to all live pairs."),
  demo: z.boolean().optional().describe("Set to true to use a complimentary 10-minute preview session token.")
}).strip();

/**
 * Input schema for simulating atomic FlashFlow arbitrage execution.
 */
export const SimulateFlashflowArbitrageSchema = z.object({
  pair: z.string().describe("Target trading pair to simulate (e.g., 'cbBTC/USDC', 'WETH/USDC')."),
  notionalUsd: z.number().positive().optional().describe("Notional trade size in USD (default: 1000.0).")
}).strip();

/**
 * Input schema for querying institutional B20 RWA positive carry spreads.
 */
export const GetB20InstitutionalCarrySchema = z.object({
  assetClass: z.enum(["TREASURY", "REPO", "EQUITY", "ALL"]).optional().describe("Institutional asset class filter: TREASURY, REPO, EQUITY, or ALL.")
}).strip();
