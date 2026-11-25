import { z } from "zod";

export const TxCheckSchema = z
  .object({
    chain: z
      .enum(["base", "solana"])
      .default("base")
      .describe("Chain of the unsigned transaction. base or solana."),
    from: z
      .string()
      .optional()
      .describe("Base sender (0x...), or the Solana signer when signer is omitted."),
    to: z.string().optional().describe("Base contract (0x...). Required on Base unless raw is set."),
    data: z.string().optional().describe("Base hex calldata. Required on Base unless raw is set."),
    value: z.string().optional().describe("Base native value in wei."),
    raw: z
      .string()
      .optional()
      .describe("Base serialized unsigned transaction, or the Solana transaction when tx is omitted."),
    signer: z.string().optional().describe("Solana account that would sign."),
    tx: z.string().optional().describe("Unsigned Solana transaction, base64 or base58."),
  })
  .strip()
  .describe("Check one unsigned transaction. Nothing is signed or broadcast.");

export const DeliveryScoreSchema = z
  .object({
    url: z
      .string()
      .describe("https x402 URL to score from 0 to 100. This action does not pay that URL."),
  })
  .strip()
  .describe("Score an x402 URL.");
