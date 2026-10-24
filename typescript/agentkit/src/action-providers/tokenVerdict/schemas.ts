import { z } from "zod";

/**
 * Input schema for the Token Verdict action — mirrors the Token Verdict
 * service's real request contract (POST /v1/verdict):
 *
 *   { "address": "0x...", "chain": "base" | "ethereum" | "solana" }
 *
 * `address` is required; `chain` defaults to "base". (Chain selects which
 * token market to analyze; payment always settles in USDC on Base.)
 */
export const TokenVerdictSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "address must be a 0x token contract address")
      .describe("Token contract address (0x...)"),
    chain: z
      .enum(["base", "ethereum", "solana"])
      .default("base")
      .describe("Chain label: base | ethereum | solana"),
  })
  .strict()
  .describe("Instructions for getting a token risk verdict");

export type TokenVerdictArgs = z.infer<typeof TokenVerdictSchema>;
