import { z } from "zod";

/**
 * Input schema for the Token Verdict pre-trade check.
 */
export const CheckTokenSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "tokenAddress must be a 0x-prefixed 20-byte address")
      .describe("The Base token contract address to check before trading (0x...)"),
  })
  .strict();

/**
 * Configuration for TokenVerdictActionProvider.
 */
export const TokenVerdictConfigSchema = z
  .object({
    url: z
      .string()
      .url()
      .optional()
      .describe("Token Verdict endpoint URL (defaults to the production endpoint)"),
    maxPaymentUsdc: z
      .number()
      .positive()
      .max(0.02)
      .optional()
      .describe("Hard cap for a single check, in USDC. Cannot exceed the $0.02 endpoint price."),
  })
  .strict();

export type TokenVerdictConfig = z.infer<typeof TokenVerdictConfigSchema>;
