import { z } from "zod";

export const CheckTokenRugShieldSchema = z
  .object({
    mint: z
      .string()
      .min(32)
      .max(44)
      .describe(
        "Public base58 Solana token mint address (SPL, Token-2022, or pump.fun). Never pass private keys or seed phrases.",
      ),
  })
  .strip()
  .describe("Parameters for running an 11-layer pre-buy Solana token rug audit.");

export const ScanWalletUnclaimedRentSchema = z
  .object({
    wallet: z
      .string()
      .min(32)
      .max(44)
      .describe(
        "Public base58 Solana wallet address to scan for reclaimable empty ATA rent. Never pass private keys or seed phrases.",
      ),
  })
  .strip()
  .describe("Parameters for scanning a public Solana wallet for reclaimable empty ATA SOL rent.");
