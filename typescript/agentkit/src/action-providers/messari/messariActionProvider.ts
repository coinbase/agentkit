import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { MessariResearchQuestionSchema } from "./schemas";

/**
 * Configuration options for the MessariActionProvider.
 */
export interface MessariActionProviderConfig {
  /**
   * Messari API Key
   */
  apiKey?: string;
}

// Configuration constants
const CONFIG = {
  API_ENDPOINT: "https://api.messari.io/ai/v1/chat/completions",
};

/**
 * Types for API responses and errors
 */
interface MessariAPIResponse {
  data: {
    messages: Array<{
      content: string;
      role: string;
    }>;
  };
}

interface MessariError extends Error {
  status?: number;
  statusText?: string;
  responseText?: string;
}

/**
 * MessariActionProvider is an action provider for Messari AI toolkit interactions.
 * It enables AI agents to ask research questions about crypto markets, protocols, and tokens.
 *
 * @augments ActionProvider
 */
export class MessariActionProvider extends ActionProvider {
  private readonly apiKey: string;

  /**
   * Constructor for the MessariActionProvider class.
   *
   * @param config - The configuration options for the MessariActionProvider
   */
  constructor(config: MessariActionProviderConfig = {}) {
    super("messari", []);

    config.apiKey ||= process.env.MESSARI_API_KEY;

    if (!config.apiKey) {
      throw new Error("MESSARI_API_KEY is not configured.");
    }

    this.apiKey = config.apiKey;
  }

  /**
   * Makes a request to the Messari AI API with a research question
   *
   * @param args - The arguments containing the research question
   * @returns A string containing the research results or an error message
   */
  @CreateAction({
    name: "research_question",
    description: `
This tool will query the Messari AI toolkit with a research question about crypto markets, protocols, or tokens.

Use this tool for questions like:
1. Market data, statistics, or metrics
2. Rankings or comparisons
3. Historical data or trends
4. Information about specific protocols, tokens, or platforms
5. Financial analysis or performance data

A successful response will return the research findings from Messari.
A failure response will return an error message with details.

Examples of good questions:
- "What are the top 10 L2s by fees?"
- "What is the current price of ETH?"
- "What is the TVL of Arbitrum?"
- "How has Bitcoin's market cap changed over the last month?"
    `,
    schema: MessariResearchQuestionSchema,
  })
  async researchQuestion(args: z.infer<typeof MessariResearchQuestionSchema>): Promise<string> {
    try {
      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-messari-api-key": this.apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: args.question,
            },
          ],
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        const error = new Error() as MessariError;
        error.status = response.status;
        error.statusText = response.statusText;
        error.responseText = responseText;
        throw error;
      }

      const data = (await response.json()) as MessariAPIResponse;
      const result = data.data.messages[0].content;

      return `Messari Research Results:\n\n${result}`;
    } catch (error) {
      const err = error as MessariError;
      const errorDetails = {
        status: err.status,
        statusText: err.statusText,
        responseText: err.responseText,
        message: err.message,
      };

      return `Error querying Messari AI: ${JSON.stringify(errorDetails, null, 2)}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Messari research is network-agnostic, so it supports all networks.
   *
   * @param _ - The network to check
   * @returns Always returns true as Messari research is network-agnostic
   */
  supportsNetwork(_: Network): boolean {
    return true; // Messari research is network-agnostic
  }
}

/**
 * Factory function to create a new MessariActionProvider instance.
 *
 * @param config - The configuration options for the MessariActionProvider
 * @returns A new instance of MessariActionProvider
 */
export const messariActionProvider = (config: MessariActionProviderConfig = {}) =>
  new MessariActionProvider(config);
