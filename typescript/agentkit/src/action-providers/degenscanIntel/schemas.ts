import { z } from "zod";

export const GetMarketEventsSchema = z
  .object({
    since: z
      .string()
      .default("4h")
      .describe('Lookback window, e.g. "1h", "4h", "24h" or an ISO timestamp'),
    universe: z
      .array(z.string())
      .optional()
      .describe(
        "Asset ids to filter on, e.g. ['BTC','ETH','NVDA','CL']. Omit for all covered assets.",
      ),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe("Minimum impact confidence (0..1)"),
    limit: z.number().int().min(1).max(200).default(30),
  })
  .strip()
  .describe("Instructions for fetching price-moving market events with per-asset impacts");

export const GetAssetBriefSchema = z
  .object({
    assetId: z.string().describe("Asset id, e.g. BTC, ETH, NVDA, MSTR, CL, GC"),
    since: z.string().default("24h"),
  })
  .strip()
  .describe("Instructions for fetching a one-call pre-trade brief for one asset");

export const GetPerpDerivsSchema = z
  .object({
    symbol: z.string().describe("Perp coin as listed on Hyperliquid, e.g. BTC, ETH, SOL, HYPE"),
  })
  .strip()
  .describe("Instructions for fetching perp funding, open interest and premium for one coin");

export const GetDeribitPerpsSchema = z
  .object({
    symbols: z
      .array(z.string())
      .optional()
      .describe(
        "Coins to return, e.g. ['BTC','ETH','SOL','NVDA']. One symbol adds 7 days of hourly funding history. Omit for all perps.",
      ),
    sort: z
      .enum(["volume", "oi", "funding", "neg_funding", "abs_funding", "gap"])
      .default("volume")
      .describe("Sort order; 'gap' = largest funding gap vs Hyperliquid"),
    limit: z.number().int().min(1).max(150).default(25),
  })
  .strip()
  .describe(
    "Instructions for fetching Deribit perpetuals (venue for Coinbase Advanced international perps)",
  );

export const GetPulseSchema = z
  .object({})
  .strip()
  .describe("No inputs — cheapest probe of what happened in the last hour");
