import { z } from "zod";

export const MONEYTOOLS_CHAINS = [
  "base",
  "ethereum",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
  "avalanche",
] as const;

const ChainSchema = z
  .enum(MONEYTOOLS_CHAINS)
  .default("base")
  .describe("EVM chain to read from (default base). Payment always settles in USDC on Base.");

export const WalletRiskSchema = z
  .object({
    address: z
      .string()
      .describe(
        "The 0x address or ENS name to score, e.g. a counterparty the agent is about to pay",
      ),
    chain: ChainSchema,
  })
  .describe("Get a wallet risk card for an EVM address");

export const TokenSafetySchema = z
  .object({
    token: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid ERC-20 address")
      .describe("ERC-20 address"),
    chain: ChainSchema,
    usd: z
      .number()
      .positive()
      .max(10000)
      .default(10)
      .describe("Notional USD size for the simulated USDC->token->USDC round trip (default 10)"),
  })
  .describe("Simulate a buy and sell of an ERC-20 to detect honeypots and sell taxes");

export const TokenInfoSchema = z
  .object({
    token: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid ERC-20 address")
      .describe("ERC-20 address"),
    chain: ChainSchema,
  })
  .describe("Read ERC-20 facts: name, symbol, decimals, supply, owner, paused, proxy");

export interface MoneyToolsConfig {
  /** API origin. Defaults to https://tools.moneytools.dev */
  baseUrl?: string;
  /** Maximum USDC the provider will pay for one call. Defaults to 0.02. */
  maxPaymentUsdc?: number;
}
