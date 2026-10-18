import { z } from "zod";

const marketField = z
  .string()
  .min(1, "Market is required.")
  .describe(
    "The Polymarket market: a condition id (0x + 64 hex), a numeric market id, or a market slug",
  );

/**
 * Input schema for the free, signed settlement-risk check.
 */
export const GetSettlementRiskSchema = z
  .object({
    market: marketField,
  })
  .strip()
  .describe("Input schema for checking the settlement risk of a Polymarket market");

/**
 * Input schema for the paid settlement estimate.
 */
export const GetSettlementEstimateSchema = z
  .object({
    market: marketField,
  })
  .strip()
  .describe("Input schema for buying a signed settlement estimate for a Polymarket market");

/**
 * Input schema for verifying a Predge signed record.
 */
export const VerifyRecordSchema = z
  .object({
    record: z
      .string()
      .min(1, "Record is required.")
      .describe(
        "A Predge signed record as a JSON string: a full API response or its `attestation` envelope",
      ),
  })
  .strip()
  .describe("Input schema for verifying a Predge signed record offline");

/**
 * Input schema for the paid whale trade feed.
 */
export const GetWhaleTradesSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Number of trades to return (1-100, default 20)"),
  })
  .strip()
  .describe("Input schema for the latest Polymarket whale trades");
