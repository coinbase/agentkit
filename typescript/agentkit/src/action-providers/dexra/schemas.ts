import { z } from "zod";

const SolanaAddress = z.string().min(32).max(44);

/**
 * Input schema for describing a Solana address.
 */
export const DescribeAddressSchema = z
  .object({
    address: SolanaAddress.describe("Any Solana address: wallet, token mint, pool or program"),
  })
  .strip()
  .describe("Instructions for describing a Solana address");

/**
 * Input schema for a deep check of a Solana token.
 */
export const TokenDeepCheckSchema = z
  .object({
    mint: SolanaAddress.describe("The token mint address"),
  })
  .strip()
  .describe("Instructions for checking a Solana token's holders, liquidity and mint");

/**
 * Input schema for listing new Solana token launches.
 */
export const NewLaunchesSchema = z
  .object({
    minutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .describe("Look-back window in minutes, 1 to 1440 (default 15)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum number of launches to return, 1 to 20 (default 20)"),
    minLiquidityUsd: z
      .number()
      .min(0)
      .optional()
      .describe("Only launches with at least this much liquidity in USD"),
    platforms: z
      .array(
        z.enum([
          "pump_fun",
          "letsbonk",
          "raydium_launchlab",
          "meteora_dbc",
          "pump_swap",
          "raydium_amm_v4",
          "raydium_cpmm",
        ]),
      )
      .optional()
      .describe("Launch platforms to include (default all)"),
    includeCollapsed: z
      .boolean()
      .optional()
      .describe("Include launches whose liquidity already collapsed (default false)"),
  })
  .strip()
  .describe("Instructions for listing new Solana token launches with a verdict for each");

/**
 * Input schema for checking a Solana wallet.
 */
export const WalletCheckSchema = z
  .object({
    address: SolanaAddress.describe("The Solana wallet address to check"),
  })
  .strip()
  .describe("Instructions for checking a Solana wallet");

/**
 * Input schema for checking a Solana liquidity pool.
 */
export const PoolHealthSchema = z
  .object({
    pool: SolanaAddress.describe(
      "The pool address (Raydium AMM, CPMM or CLMM, Orca Whirlpool, Meteora DLMM or PumpSwap)",
    ),
  })
  .strip()
  .describe("Instructions for checking the health of a Solana liquidity pool");

/**
 * Input schema for checking a planned Solana swap.
 */
export const SwapPreflightSchema = z
  .object({
    mint: SolanaAddress.describe("The token mint to buy or sell"),
    side: z.enum(["buy", "sell"]).describe("Whether the swap buys or sells the token"),
    amount: z
      .number()
      .positive()
      .describe("Amount in quote units for a buy (e.g. SOL), in token units for a sell"),
    quote: SolanaAddress.optional().describe("The quote mint (default SOL)"),
  })
  .strip()
  .describe("Instructions for checking a planned Solana swap before sending it");
