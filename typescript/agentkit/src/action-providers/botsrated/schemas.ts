import { z } from "zod";

export const BotsRatedPreflightSchema = z
  .object({
    url: z
      .string()
      .min(1)
      .describe(
        "The x402 seller URL (or host) the agent is about to pay, e.g. https://api.example.com/v1/data",
      ),
    payTo: z
      .string()
      .optional()
      .describe(
        "Optional: the payTo address from the seller's 402 payment option, to compare with what BotsRated has seen",
      ),
    network: z
      .string()
      .optional()
      .describe("Optional: the network of that payment option, e.g. eip155:8453"),
  })
  .strip()
  .describe("Instructions for a free BotsRated preflight lookup of an x402 seller");

export const BotsRatedPaidCheckSchema = z
  .object({
    host: z
      .string()
      .min(1)
      .describe("The x402 seller host or URL to look up, e.g. api.example.com"),
  })
  .strip()
  .describe(
    "Instructions for a paid BotsRated check of an x402 seller (free daily quota applies; see https://botsrated.com/pricing.json)",
  );

/**
 * Configuration for the BotsRated action provider.
 */
export interface BotsRatedConfig {
  /** Defaults to https://botsrated.com */
  baseUrl?: string;
  /**
   * Total USDC the provider may spend on paid BotsRated checks (free daily quota answers are not counted; see https://botsrated.com/pricing.json).
   * Paid checks are disabled unless this is set (or BOTSRATED_MAX_SPEND_USDC is set).
   */
  maxSpendUsdc?: number;
}
