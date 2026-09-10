import { z } from "zod";

/**
 * An EVM address (0x-prefixed, 40 hex chars).
 */
const EvmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 0x-prefixed EVM address");

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
