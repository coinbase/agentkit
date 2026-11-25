import { z } from "zod";

const BASE_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const tokenField = z
  .string()
  .trim()
  .refine(v => BASE_ADDRESS.test(v) || SOLANA_ADDRESS.test(v), {
    message: "Must be a Base ERC-20 address (0x + 40 hex) or a Solana mint (base58)",
  })
  .describe(
    "Token address: a Base ERC-20 contract (0x...) or a Solana SPL / Token-2022 mint (base58)",
  );

const chainField = z
  .enum(["base", "solana"])
  .optional()
  .describe("Chain of the token: 'base' or 'solana'. Optional, detected from the address format.");

/**
 * Input schema for token_risk_verdict.
 */
export const TokenRiskVerdictSchema = z
  .object({
    token: tokenField,
    chain: chainField,
  })
  .strip()
  .describe("Instructions for getting a risk verdict on a Base or Solana token");

/**
 * Input schema for token_pre_trade_pack.
 */
export const TokenPreTradePackSchema = z
  .object({
    token: tokenField,
    chain: chainField,
    wallet: z
      .string()
      .trim()
      .refine(v => BASE_ADDRESS.test(v) || SOLANA_ADDRESS.test(v), {
        message: "Must be a Base 0x address or a Solana base58 address",
      })
      .optional()
      .describe(
        "Optional counterparty or paying wallet (Base 0x... or Solana base58) to screen against OFAC and check USDC pay-readiness",
      ),
    amount: z
      .number()
      .positive()
      .max(1_000_000)
      .optional()
      .describe("Optional USDC amount the wallet intends to pay (only used together with wallet)"),
  })
  .strip()
  .describe("Instructions for a GO / CAUTION / STOP pre-trade check on a Base or Solana token");

/**
 * Input schema for token_whale_flow.
 */
export const TokenWhaleFlowSchema = z
  .object({
    token: tokenField,
    chain: chainField,
    hours: z
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .describe("Look-back window in hours, 1-24 (default 24)"),
    minUsd: z
      .number()
      .min(50)
      .max(1_000_000)
      .optional()
      .describe(
        "Minimum trade size in USD to count as a whale trade (default: scaled to liquidity)",
      ),
  })
  .strip()
  .describe("Instructions for getting large-wallet (whale) DEX flow for a Base or Solana token");

/**
 * Detects the chain from an address format.
 *
 * @param address - A Base 0x address or Solana base58 address
 * @returns "base", "solana", or undefined when the format is not recognised
 */
export function detectChain(address: string): "base" | "solana" | undefined {
  if (BASE_ADDRESS.test(address)) return "base";
  if (SOLANA_ADDRESS.test(address)) return "solana";
  return undefined;
}
