import { z } from "zod";

/**
 * Input schema for getting near-liquidation positions
 */
export const GetLiquidationWavesSchema = z
  .object({
    protocol: z
      .enum(["all", "aaveV3", "spark", "morpho"])
      .optional()
      .describe("Filter by protocol. Defaults to 'all' (Aave V3, Spark, Morpho Blue)"),
    chain: z
      .enum(["all", "mainnet", "base"])
      .optional()
      .describe("Filter by chain. Defaults to 'all'"),
  })
  .strict();

/**
 * Input schema for getting the searcher leaderboard
 */
export const GetSearcherLeaderboardSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Number of searchers to return (1-25). Free tier returns top 5."),
  })
  .strict();

/**
 * Input schema for getting builder recommendation
 */
export const GetBuilderRecommendationSchema = z
  .object({})
  .strict();

/**
 * Input schema for getting the MEV event feed
 */
export const GetMevFeedSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Number of events to return. Free tier returns 10."),
  })
  .strict();
