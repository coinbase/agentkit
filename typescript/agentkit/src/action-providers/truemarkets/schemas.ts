import { z } from "zod";

/**
 * Input schema for get active markets action.
 */
export const GetTruthMarketsSchema = z
  .object({
    limit: z
      .number()
      .nullable()
      .transform(val => val ?? 10)
      .describe("Maximum number of markets to return (default: 10)"),
    offset: z
      .number()
      .nullable()
      .transform(val => val ?? 0)
      .describe("Number of markets to skip (for pagination)"),
    sortOrder: z
      .enum(["asc", "desc"])
      .nullable()
      .transform(val => val ?? "desc")
      .describe("Sort order for the markets (default: desc)"),
  })
  .describe("Instructions for getting prediction markets on Truemarkets");

/**
 * Input schema for get market details action.
 */
export const GetTruthMarketDetailsSchema = z
  .string()
  .describe("Prediction market address (0x...) or market ID (number) to retrieve details for");
