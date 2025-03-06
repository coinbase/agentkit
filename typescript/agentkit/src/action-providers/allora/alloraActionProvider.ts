import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  AlloraAPIClient,
  AlloraAPIClientConfig,
  ChainSlug,
  PriceInferenceTimeframe,
  PriceInferenceToken,
} from "@alloralabs/allora-sdk";
import { z } from "zod";
import {
  GetAllTopicsSchema,
  GetInferenceByTopicIdSchema,
  GetPriceInferenceSchema,
} from "./schemas";

/**
 * Action provider for interacting with Allora Network
 */
export class AlloraActionProvider extends ActionProvider {
  private client: AlloraAPIClient;

  /**
   * Creates an instance of AlloraActionProvider
   *
   * @param config - Configuration for the Allora API client including API key and optional chain slug
   */
  constructor(config: AlloraAPIClientConfig = {}) {
    super("allora", []);
    // This is a public, development only key and should be used for testing purposes only.
    // It might be changed or revoked in the future. It is also subject to limits and usage policies.
    const DEFAULT_API_KEY = "UP-4151d0cc489a44a7aa5cd7ef";

    config.apiKey = config.apiKey || DEFAULT_API_KEY;
    config.chainSlug = config.chainSlug || ChainSlug.TESTNET;
    this.client = new AlloraAPIClient(config);
  }

  /**
   * Gets all available topics from Allora Network
   *
   * @param _ - Empty object as no parameters are required
   * @returns A string containing the list of topics in JSON format
   */
  @CreateAction({
    name: "get_all_topics",
    description: `
This tool will get all available inference topics from Allora Network.

A successful response will return a list of available topics in JSON format. Example:
[
    {
        "topic_id": 1,
        "topic_name": "Bitcoin 8h",
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

Key fields:
- topic_id: Unique identifier, use with get_inference_by_topic_id action
- topic_name: Name of the topic
- description: Short description of the topic's purpose
- is_active: If true, topic is active and accepting submissions
- updated_at: Timestamp of last update

A failure response will return an error message with details.
`,
    schema: GetAllTopicsSchema,
  })
  async getAllTopics(_: z.infer<typeof GetAllTopicsSchema>): Promise<string> {
    try {
      const topics = await this.client.getAllTopics();
      const topicsJson = JSON.stringify(topics);
      return `The available topics at Allora Network are:\n ${topicsJson}`;
    } catch (error) {
      return `Error getting all topics: ${error}`;
    }
  }

  /**
   * Gets inference data for a specific topic from Allora Network
   *
   * @param args - Object containing the topic ID to get inference for
   * @returns A string containing the inference data in JSON format
   */
  @CreateAction({
    name: "get_inference_by_topic_id",
    description: `
This tool will get inference for a specific topic from Allora Network.
It requires a topic ID as input, which can be obtained from the get_all_topics action.

A successful response will return a message with the inference data in JSON format. Example:
    {
        "network_inference": "0.5",
        "network_inference_normalized": "0.5",
        "confidence_interval_percentiles": ["0.1", "0.5", "0.9"],
        "confidence_interval_percentiles_normalized": ["0.1", "0.5", "0.9"],
        "confidence_interval_values": ["0.1", "0.5", "0.9"],
        "confidence_interval_values_normalized": ["0.1", "0.5", "0.9"],
        "topic_id": "1",
        "timestamp": 1718198400,
        "extra_data": "extra_data"
    }
The network_inference field is the inference for the topic.
The network_inference_normalized field is the normalized inference for the topic.

A failure response will return an error message with details.
`,
    schema: GetInferenceByTopicIdSchema,
  })
  async getInferenceByTopicId(args: z.infer<typeof GetInferenceByTopicIdSchema>): Promise<string> {
    try {
      const inference = await this.client.getInferenceByTopicID(args.topicId);
      const inferenceJson = JSON.stringify(inference.inference_data);
      return `The inference for topic ${args.topicId} is:\n ${inferenceJson}`;
    } catch (error) {
      return `Error getting inference for topic ${args.topicId}: ${error}`;
    }
  }

  /**
   * Gets price inference for a token/timeframe pair from Allora Network
   *
   * @param args - Object containing the asset symbol and timeframe
   * @returns A string containing the price inference data in JSON format
   */
  @CreateAction({
    name: "get_price_inference",
    description: `
This tool will get price inference for a specific token and timeframe from Allora Network.
It requires an asset symbol (e.g., 'BTC', 'ETH') and a timeframe (e.g., '8h', '24h') as input.

A successful response will return a message with the price inference. Example:
    The price inference for BTC (8h) is:
    {
        "price": "100000",
        "timestamp": 1718198400,
        "asset": "BTC",
        "timeframe": "8h"
    }

A failure response will return an error message with details.
`,
    schema: GetPriceInferenceSchema,
  })
  async getPriceInference(args: z.infer<typeof GetPriceInferenceSchema>): Promise<string> {
    try {
      const inference = await this.client.getPriceInference(
        args.asset as PriceInferenceToken,
        args.timeframe as PriceInferenceTimeframe,
      );
      const response = {
        price: inference.inference_data.network_inference_normalized,
        timestamp: inference.inference_data.timestamp,
        asset: args.asset,
        timeframe: args.timeframe,
      };
      const inferenceJson = JSON.stringify(response);
      return `The price inference for ${args.asset} (${args.timeframe}) is:\n${inferenceJson}`;
    } catch (error) {
      return `Error getting price inference for ${args.asset} (${args.timeframe}): ${error}`;
    }
  }

  /**
   * Checks if the provider supports a given network
   *
   * @returns Always returns true as Allora service is network-agnostic
   */
  supportsNetwork(): boolean {
    return true; // Allora service is network-agnostic
  }
}

export const alloraActionProvider = (config: AlloraAPIClientConfig = {}) =>
  new AlloraActionProvider(config);
