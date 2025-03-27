import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { MessariResearchQuestionSchema } from "./schemas";
import { MESSARI_BASE_URL, API_KEY_MISSING_ERROR } from "./constants";
import { MessariActionProviderConfig, MessariAPIResponse, MessariError } from "./types";
import { createMessariError, formatMessariApiError, formatGenericError } from "./utils";

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
      throw new Error(API_KEY_MISSING_ERROR);
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
      const response = await fetch(`${MESSARI_BASE_URL}/chat/completions`, {
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
        throw await createMessariError(response);
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
        return formatMessariApiError(error as MessariError);
      }

      return formatGenericError(error);
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
