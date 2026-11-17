import { z } from "zod";

/**
 * Input schema for a RugRadar Solana token risk check
 */
export const CheckSolanaTokenRiskSchema = z
  .object({
    query: z
      .string()
      .min(2)
      .max(300)
      .describe("Solana token mint address, pump.fun or DexScreener link, or $TICKER"),
  })
  .strip()
  .describe("Input schema for a RugRadar Solana token risk check");

/**
 * Input schema for a RugRadar wallet-drainer link scan
 */
export const ScanLinkForDrainerSchema = z
  .object({
    text: z
      .string()
      .min(4)
      .max(2000)
      .describe("A URL or pasted post text to scan for wallet-drainer and phishing patterns"),
  })
  .strip()
  .describe("Input schema for a RugRadar wallet-drainer link scan");
