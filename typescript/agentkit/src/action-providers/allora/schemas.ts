import { z } from "zod";

/**
 * Input schema for getting all topics from Allora Network
 */
export const GetAllTopicsSchema = z
  .object({})
  .strip()
  .describe("Instructions for getting all topics from Allora Network");

/**
 * Input schema for getting inference data by topic ID from Allora Network
 */
export const GetInferenceByTopicIdSchema = z
  .object({
    topicId: z.number().describe("The ID of the topic to get inference data for"),
  })
  .strip()
  .describe("Instructions for getting inference data from Allora Network by topic ID");

/**
 * Input schema for getting price inference for a token/timeframe pair
 */
export const GetPriceInferenceSchema = z
  .object({
    asset: z.string().describe("The token to get price inference for (e.g., 'BTC', 'ETH')"),
    timeframe: z.string().describe("The timeframe for the prediction (e.g., '8h', '24h')"),
  })
  .strip()
  .describe("Instructions for getting price inference for a token/timeframe pair");
