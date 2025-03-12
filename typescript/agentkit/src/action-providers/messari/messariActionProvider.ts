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

interface MessariErrorResponse {
  error?: string;
  data?: null | unknown;
}

interface MessariError extends Error {
  status?: number;
  statusText?: string;
  responseText?: string;
  errorResponse?: {
    error?: string;
    data?: null | unknown;
  };
}

/**
 * MessariActionProvider is an action provider for Messari AI toolkit interactions.
 * It enables AI agents to ask research questions about crypto markets, protocols, and tokens.
 *
 * @augments ActionProvider
 */
export class MessariActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.messari.io/ai/v1";

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
This tool queries Messari AI for comprehensive crypto research across these datasets:
1. News/Content - Latest crypto news, blogs, podcasts
2. Exchanges - CEX/DEX volumes, market share, assets listed
3. Onchain Data - Active addresses, transaction fees, total transactions.
4. Token Unlocks - Upcoming supply unlocks, vesting schedules, and token emission details
5. Market Data - Asset prices, trading volume, market cap, TVL, and historical performance
6. Fundraising - Investment data, funding rounds, venture capital activity.
7. Protocol Research - Technical analysis of how protocols work, tokenomics, and yield mechanisms
8. Social Data - Twitter followers and Reddit subscribers metrics, growth trends

Examples: "Which DEXs have the highest trading volume this month?", "When is Arbitrum's next major token unlock?", "How does Morpho generate yield for users?", "Which cryptocurrency has gained the most Twitter followers in 2023?", "What did Vitalik Buterin say about rollups in his recent blog posts?"
    `,
    schema: MessariResearchQuestionSchema,
  })
  async researchQuestion(args: z.infer<typeof MessariResearchQuestionSchema>): Promise<string> {
    try {
      // Make API request
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
        throw await this.createMessariError(response);
      }

      // Parse and validate response
      let data: MessariAPIResponse;
      try {
        data = (await response.json()) as MessariAPIResponse;
      } catch (jsonError) {
        throw new Error(
          `Failed to parse API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
        );
      }
      if (!data.data?.messages?.[0]?.content) {
        throw new Error("Received invalid response format from Messari API");
      }

      const result = data.data.messages[0].content;
      return `Messari Research Results:\n\n${result}`;
    } catch (error: unknown) {
      if (error instanceof Error && "responseText" in error) {
        return this.formatMessariApiError(error as MessariError);
      }

      return this.formatGenericError(error);
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

  /**
   * Creates a MessariError from an HTTP response
   *
   * @param response - The fetch Response object
   * @returns A MessariError with response details
   */
  private async createMessariError(response: Response): Promise<MessariError> {
    const error = new Error(
      `Messari API returned ${response.status} ${response.statusText}`,
    ) as MessariError;
    error.status = response.status;
    error.statusText = response.statusText;

    const responseText = await response.text();
    error.responseText = responseText;
    try {
      const errorJson = JSON.parse(responseText) as MessariErrorResponse;
      error.errorResponse = errorJson;
    } catch {
      // If parsing fails, just use the raw text
    }

    return error;
  }

  /**
   * Formats error details for API errors
   *
   * @param error - The MessariError to format
   * @returns Formatted error message
   */
  private formatMessariApiError(error: MessariError): string {
    if (error.errorResponse?.error) {
      return `Messari API Error: ${error.errorResponse.error}`;
    }

    const errorDetails = {
      status: error.status,
      statusText: error.statusText,
      responseText: error.responseText,
      message: error.message,
    };
    return `Messari API Error: ${JSON.stringify(errorDetails, null, 2)}`;
  }

  /**
   * Formats generic errors
   *
   * @param error - The error to format
   * @returns Formatted error message
   */
  private formatGenericError(error: unknown): string {
    // Check if this might be a JSON string containing an error message
    if (typeof error === "string") {
      try {
        const parsedError = JSON.parse(error) as MessariErrorResponse;
        if (parsedError.error) {
          return `Messari API Error: ${parsedError.error}`;
        }
      } catch {
        // Not valid JSON, continue with normal handling
      }
    }

    return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
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
