import { z } from "zod";

/**
 * Input schema for checking a wallet before paying it
 */
export const CheckPaymentSchema = z
  .object({
    payTo: z
      .string()
      .describe(
        "The wallet address about to be paid (for example the payTo of an x402 payment request): a 0x address or a Solana address",
      ),
    amountUsd: z
      .number()
      .positive()
      .nullable()
      .describe(
        "Optional amount about to be paid, in US dollars. Larger amounts need a stronger record",
      ),
  })
  .strict();

/**
 * Input schema for checking a bot's record
 */
export const CheckBotSchema = z
  .object({
    agentId: z
      .string()
      .describe(
        "The bot to look up: an ERC-8004 registry id such as 'erc8004:8453:1234' (chain id and bot number), or a Keptvow agent id",
      ),
  })
  .strict();

/**
 * Input schema for telling Keptvow whether a payment delivered what was paid for
 */
export const ReportDeliverySchema = z
  .object({
    tx: z
      .string()
      .describe(
        "The transaction hash of the payment you made: 0x followed by 64 hex characters (the PAYMENT-RESPONSE header carries it)",
      ),
    delivered: z
      .boolean()
      .describe(
        "True if the paid request gave you what you paid for, false if you paid and got nothing or a broken answer",
      ),
    payTo: z.string().nullable().describe("Optional: the seller wallet you paid"),
  })
  .strict();
