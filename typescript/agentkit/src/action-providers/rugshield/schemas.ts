import { z } from "zod";

/**
 * Input schema for RugShield pre-trade token risk scan.
 */
export const RugShieldScanSchema = z
  .object({
    tokenAddress: z
      .string()
      .describe("The contract address of the token to audit (e.g. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base)"),
    chain: z
      .enum(["base", "solana"])
      .default("base")
      .describe("Blockchain network where the token resides ('base' or 'solana')"),
    simulateSell: z
      .boolean()
      .default(true)
      .describe("Whether to simulate sell calldata to test for honeypot and sell restrictions"),
  })
  .describe("Instructions for pre-trade token risk and honeypot scan");

/**
 * Input schema for fast honeypot verdict.
 */
export const RugShieldHoneypotSchema = z
  .object({
    tokenAddress: z
      .string()
      .describe("The contract address of the token to check"),
    chain: z
      .enum(["base", "solana"])
      .default("base")
      .describe("Blockchain network ('base' or 'solana')"),
  })
  .describe("Instructions for quick honeypot verification");

/**
 * Input schema for Token God Mode holder & orderflow analysis.
 */
export const RugShieldTokenGodModeSchema = z
  .object({
    tokenAddress: z
      .string()
      .describe("The contract address of the token to analyze"),
    chain: z
      .enum(["base", "solana"])
      .default("base")
      .describe("Blockchain network ('base' or 'solana')"),
  })
  .describe("Instructions for token holders and smart-money orderflow analysis");
