import { z } from "zod";

/**
 * Input schema for get active markets action.
 */
export const GetTruthMarketsSchema = z
  .object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of markets to return (default: 10)")
      .default(10),
    offset: z.number().optional().describe("Number of markets to skip (for pagination)").default(0),
    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order for the markets (default: desc)")
      .default("desc"),
  })
  .strip()
  .describe("Instructions for getting prediction markets on Truemarkets");

/**
 * Input schema for get market details action.
 */
export const GetTruthMarketDetailsSchema = z
  .string()
  .describe("Prediction market address (0x...) or market ID (number) to retrieve details for");
