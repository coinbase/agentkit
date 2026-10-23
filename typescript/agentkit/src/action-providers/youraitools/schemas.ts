import { z } from "zod";

/**
 * Configuration for {@link YourAIToolsActionProvider}.
 */
export interface YourAIToolsActionProviderConfig {
  /**
   * Pay the x402 price with the AgentKit wallet.
   * EVM wallets pay USDC on the networks the 402 response lists (Base, Polygon, Arbitrum One).
   * SVM wallets pay USDC on Solana.
   * Default false: return the 402 terms and pay nothing.
   */
  payWithWallet?: boolean;

  /**
   * Refuse any action whose list price is above this many USD per call.
   * Default 0.01. The check happens before any request.
   */
  maxPriceUsd?: number;

  /**
   * Optional prepaid credits key from https://api.youraitools.co/credits/.
   * Sent as `Authorization: Bearer`. When set, the wallet is not asked to pay.
   */
  creditsKey?: string;

  /**
   * API origin. Defaults to https://api.youraitools.co.
   */
  apiBase?: string;

  /**
   * Fetch implementation. Defaults to the global fetch. Tests inject a mock.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Input schema for payguard_screen_address.
 */
export const ScreenAddressSchema = z
  .object({
    address: z
      .string()
      .min(10)
      .describe("Crypto address to screen (EVM, BTC, Solana, and other published formats)"),
  })
  .strip()
  .describe("Input for payguard_screen_address");

/**
 * Input schema for tokenverdict_check_token.
 */
export const CheckTokenSchema = z
  .object({
    token: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("ERC-20 token contract address on Base"),
  })
  .strip()
  .describe("Input for tokenverdict_check_token");

/**
 * Input schema for smartperps_smart_money.
 */
export const SmartMoneySchema = z
  .object({
    symbol: z.string().min(1).max(20).describe("Coin symbol, for example BTC"),
  })
  .strip()
  .describe("Input for smartperps_smart_money");

/**
 * Input schema for toolpick_find_paid_api.
 */
export const FindPaidApiSchema = z
  .object({
    need: z
      .string()
      .min(2)
      .max(200)
      .describe("Capability the agent needs, for example 'web search'"),
  })
  .strip()
  .describe("Input for toolpick_find_paid_api");

/**
 * Input schema for webread_read_url.
 */
export const ReadUrlSchema = z
  .object({
    url: z.string().url().describe("Public https URL to read"),
  })
  .strip()
  .describe("Input for webread_read_url");

/**
 * Input schema for injectscan_scan_text.
 */
export const ScanTextSchema = z
  .object({
    text: z.string().min(1).max(20000).describe("Untrusted text to scan"),
  })
  .strip()
  .describe("Input for injectscan_scan_text");
