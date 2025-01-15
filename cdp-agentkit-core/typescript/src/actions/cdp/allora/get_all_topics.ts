import { AlloraAction } from "./allora_action";
import { AlloraAPIClient } from "@alloralabs/allora-sdk";
import { z } from "zod";

const GET_ALL_TOPICS_PROMPT = `
This tool will get all available topics from Allora Network.

A successful response will return a message with a list of available topics from Allora Network in JSON format:
    [
        {
            "topic_id": 1,
            "topic_name": ""Bitcoin 8h",
            "description": "Bitcoin price prediction for the next 8 hours",
            "epoch_length": 100,
            "ground_truth_lag": 10,
            "loss_method": "method1",
            "worker_submission_window": 50,
            "worker_count": 5,
            "reputer_count": 3,
            "total_staked_allo": 1000,
            "total_emissions_allo": 500,
            "is_active": true,
            "updated_at": "2023-01-01T00:00:00Z"
        }
    ]
`;

/**
 * Input schema for get all topics action.
 */
export const GetAllTopicsInput = z
  .object({})
  .strip()
  .describe("Instructions for getting all topics");

/**
 * Gets all available topics from Allora Network.
 *
 * @param client - The Allora API client.
 * @param args - The input arguments for the action.
 * @returns A message containing the topics.
 */
export async function getAllTopics(
  client: AlloraAPIClient,
  _: z.infer<typeof GetAllTopicsInput>,
): Promise<string> {
  try {
    const topics = await client.getAllTopics();
    const topicsJson = JSON.stringify(topics);
    return `The available topics at Allora Network are:\n ${topicsJson}`;
  } catch (error) {
    return `Error getting all topics: ${error}`;
  }
}

/**
 * Get all topics action.
 */
export class GetAllTopicsAction implements AlloraAction<typeof GetAllTopicsInput> {
  public name = "get_all_topics";
  public description = GET_ALL_TOPICS_PROMPT;
  public argsSchema = GetAllTopicsInput;
  public func = getAllTopics;
}
