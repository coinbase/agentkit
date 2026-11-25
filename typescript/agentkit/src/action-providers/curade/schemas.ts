import { z } from "zod";

// --- Polymarket odds ---

export const PolymarketOddsSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(0)
      .max(200)
      .optional()
      .describe("Max rows. Default 25, hard cap 200"),
    q: z
      .string()
      .optional()
      .describe("Case-insensitive substring filter on the market question"),
  })
  .describe(
    "Query parameters for the latest Polymarket odds snapshot ($0.005 per call via x402 USDC)",
  );

// --- Polymarket disagreement ---

export const PolymarketDisagreementSchema = z
  .object({})
  .describe(
    "No inputs. Returns the Polymarket vs Kalshi cross-venue disagreement report ($0.02 per call via x402 USDC)",
  );

// --- Polymarket package ---

export const PolymarketPackageSchema = z
  .object({
    market: z
      .string()
      .describe("Polymarket market slug-or-id, matched exactly, case-insensitive"),
  })
  .describe(
    "Parameters for the one-time purchase of the full attested data package for a single Polymarket market ($2.00 per market via x402 USDC)",
  );

// --- Hyperliquid funding ---

export const HyperliquidFundingSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max coins served, ranked by open interest (desc). Default 100, hard cap 100"),
  })
  .describe(
    "Query parameters for the latest Hyperliquid funding-rate snapshot ($0.001 per call via x402 USDC)",
  );
