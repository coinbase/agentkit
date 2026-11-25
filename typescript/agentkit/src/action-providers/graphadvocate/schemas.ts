import { z } from "zod";

/**
 * An EVM address (0x-prefixed, 40 hex chars).
 */
const EvmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 0x-prefixed EVM address");

/**
 * Input schema for the free live preview.
 */
export const PreviewSchema = z
  .object({
    q: z
      .string()
      .min(1)
      .describe("Plain-English onchain data question, e.g. 'uniswap v3 pools' or 'aave tvl'"),
  })
  .describe("Free live top-3 preview of an onchain data question via Graph Advocate");

/**
 * Input schema for the paid onchain data router.
 */
export const RouteSchema = z
  .object({
    request: z
      .string()
      .min(1)
      .describe(
        "Plain-English onchain data question, e.g. 'uniswap v3 pools', 'aave tvl', or 'who owns vitalik.eth'",
      ),
    execute: z.boolean().optional().describe("Run the query and return rows (default true)"),
  })
  .describe("Route an onchain data question via Graph Advocate POST /route");

/**
 * Input schema for natural-language Q&A over the x402 Base settlements warehouse.
 */
export const AskSchema = z
  .object({
    question: z
      .string()
      .min(1)
      .max(1000)
      .describe(
        "A question about x402 USDC settlements on Base, e.g. 'Top 10 recipient addresses last 30 days'",
      ),
  })
  .describe("Ask a question over the x402 Base settlements warehouse via Graph Advocate");

/**
 * Input schema for scoring a wallet's Hyperliquid perps trading skill.
 */
export const HyperliquidTraderScoreSchema = z
  .object({
    wallet: EvmAddressSchema.describe(
      "The wallet address to score for Hyperliquid perps trading skill",
    ),
  })
  .describe("Score a wallet's Hyperliquid perps trading skill via Graph Advocate");

/**
 * Input schema for scoring a wallet's Polymarket trading skill.
 */
export const PolymarketTraderScoreSchema = z
  .object({
    wallet: EvmAddressSchema.describe(
      "The wallet address to score for Polymarket prediction-market trading skill",
    ),
  })
  .describe("Score a wallet's Polymarket trading skill via Graph Advocate");

/**
 * Input schema for scoring an agent/wallet's onchain reputation.
 */
export const AgentReputationSchema = z
  .object({
    wallet: EvmAddressSchema.describe(
      "The agent or wallet address to score for onchain reputation (ERC-8004 identity + USDC settlement history)",
    ),
  })
  .describe("Score an agent/wallet's onchain reputation via Graph Advocate");
