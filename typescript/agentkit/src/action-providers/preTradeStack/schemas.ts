import { z } from "zod";

const EvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "address must be a 0x EVM address");

/**
 * Input schema for the Pre-Trade Guard action — mirrors StallRow's real
 * request contract (POST /v1/pre-trade-guard):
 *
 *   { "pay_to": "0x...", "amount"?, "network"?, "resource"? }
 *
 * `pay_to` is required; the rest refine the screen when known.
 */
export const PreTradeGuardSchema = z
  .object({
    pay_to: EvmAddress.describe("The payTo address you are about to pay (0x...)"),
    amount: z
      .union([z.number(), z.string()])
      .optional()
      .describe(
        "Optional amount you are about to pay, in the asset's smallest units (e.g. 20000 for $0.02 USDC)",
      ),
    network: z
      .string()
      .optional()
      .describe("Optional network id (default eip155:8453, Base)"),
    resource: z
      .string()
      .optional()
      .describe("Optional resource URL of the listing you are about to pay"),
  })
  .strict()
  .describe("Instructions for screening a payTo before paying it");

export type PreTradeGuardArgs = z.infer<typeof PreTradeGuardSchema>;

/**
 * Input schema for the Counterparty Report action — mirrors StallRow's
 * real request contract (POST /v1/counterparty-report):
 *
 *   { "pay_to": "0x...", "token_address"?, "chain"?, "service_url"? }
 */
export const CounterpartyReportSchema = z
  .object({
    pay_to: EvmAddress.describe("The seller's payTo address (0x...)"),
    token_address: z
      .string()
      .optional()
      .describe("Optional token contract for the Token Verdict leg"),
    chain: z
      .string()
      .default("base")
      .describe("Chain for the Token Verdict leg (default base)"),
    service_url: z
      .string()
      .optional()
      .describe("Optional service endpoint URL for the LockSmith audit leg"),
  })
  .strict()
  .describe("Instructions for a full counterparty report on a seller");

export type CounterpartyReportArgs = z.infer<typeof CounterpartyReportSchema>;

/**
 * Input schema for the Receipt Verifier action — mirrors StallRow's real
 * request contract (POST /v1/receipt-verify):
 *
 *   { "tx_hash": "0x<64 hex>" }
 */
export const ReceiptVerifySchema = z
  .object({
    tx_hash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "tx_hash must be 0x + 64 hex characters")
      .describe("Base transaction hash to verify (0x + 64 hex)"),
  })
  .strict()
  .describe("Instructions for verifying a Base payment receipt");

export type ReceiptVerifyArgs = z.infer<typeof ReceiptVerifySchema>;
