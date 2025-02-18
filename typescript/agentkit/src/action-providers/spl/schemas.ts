import { z } from "zod";

/**
 * Schema for transferring SPL tokens to another address.
 */
export const TransferTokenSchema = z
  .object({
    recipient: z.string().describe("The recipient's Solana address"),
    mintAddress: z.string().describe("The SPL token's mint address"),
    amount: z.number().positive().describe("Amount of tokens to transfer"),
  })
  .describe("Transfer SPL tokens to another Solana address");

/**
 * Schema for getting SPL token balance.
 */
export const GetBalanceSchema = z
  .object({
    mintAddress: z.string().describe("The SPL token's mint address"),
    address: z
      .string()
      .optional()
      .describe(
        "Optional address to check balance for. If not provided, uses the wallet's address",
      ),
  })
  .describe("Get SPL token balance for an address");
