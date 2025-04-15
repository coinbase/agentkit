import { z } from "zod";

/**
 * Input schema for get active markets action.
 */
export const GetActiveTruthMarketsSchema = z
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
  .describe("Instructions for getting active markets on Truemarkets");

/**
 * Input schema for get market details action.
 */
export const GetMarketDetailsSchema = z
  .object({
    marketAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("Address of the market to retrieve details for"),
  })
  .strip()
  .describe("Instructions for getting detailed information about a specific market on Truemarkets");
