import { z } from "zod";

const EvmChain = z.enum(["ethereum", "base", "arbitrum", "optimism", "polygon"]);
const EvmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 0x-prefixed EVM address");

/**
 * Input schema for simulating transactions before signing.
 */
export const SimulateTransactionSchema = z
  .object({
    chain: EvmChain.default("base").describe("Chain the transactions will be sent on"),
    from: EvmAddress.optional().describe(
      "Address that will sign. Defaults to the agent's own wallet address.",
    ),
    transactions: z
      .array(
        z.object({
          to: EvmAddress.describe("Target contract or recipient"),
          data: z
            .string()
            .regex(/^0x[0-9a-fA-F]*$/)
            .default("0x")
            .describe("Calldata as 0x-hex"),
          value: z.string().default("0").describe("Native value in wei, decimal or 0x-hex"),
        }),
      )
      .min(1)
      .max(5)
      .describe("1-5 transactions executed in order; state carries over (e.g. approve, then swap)"),
  })
  .strip()
  .describe("Simulate transactions before signing them");

/**
 * Input schema for counterparty address screening.
 */
export const CheckAddressesSchema = z
  .object({
    addresses: z
      .array(z.string().min(32).max(64))
      .min(1)
      .max(100)
      .describe("EVM (0x...) or Solana addresses to screen"),
    chain: z
      .enum(["ethereum", "base", "arbitrum", "optimism", "polygon", "solana"])
      .default("base")
      .describe("Chain the addresses are used on"),
  })
  .strip()
  .describe("Screen addresses against sanctions and scam lists");

/**
 * Input schema for a pre-trade token check.
 */
export const TokenCheckSchema = z
  .object({
    tokenAddress: EvmAddress.describe("ERC-20 token contract address"),
    chain: z.enum(["ethereum", "base", "polygon", "arbitrum"]).default("base"),
  })
  .strip()
  .describe("Check a token before buying it");

/**
 * Input schema for the new token launch feed.
 */
export const NewLaunchesSchema = z
  .object({
    chain: z.enum(["base", "ethereum", "arbitrum"]).default("base"),
    since: z
      .string()
      .optional()
      .describe("ISO timestamp; only launches after it. Pass the previous response's nextSince."),
    minLiquidityUsd: z.number().min(0).default(1000),
    maxRiskScore: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Only return launches scoring at or below this risk score"),
  })
  .strip()
  .describe("List newly launched, risk-scored tokens");

/**
 * Input schema for batch token risk scoring.
 */
export const ScoreTokensSchema = z
  .object({
    tokenAddresses: z.array(EvmAddress).min(2).max(25),
    chain: EvmChain.default("base"),
  })
  .strip()
  .describe("Rug-check a list of tokens");

/**
 * Input schema for Aave v3 lending health.
 */
export const LendingHealthSchema = z
  .object({
    address: EvmAddress.optional().describe("Wallet to check. Defaults to the agent's own wallet."),
    chain: z.enum(["all", "ethereum", "base", "arbitrum", "optimism", "polygon"]).default("all"),
  })
  .strip()
  .describe("Check Aave v3 liquidation risk");
