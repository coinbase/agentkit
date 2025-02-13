import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { GetTokenPricesSchema, GetProtocolSchema, SearchProtocolsSchema } from "./schemas";

/**
 * DefiLlamaActionProvider is an action provider for DefiLlama API interactions.
 */
export class DefiLlamaActionProvider extends ActionProvider {
  private readonly baseUrl = "https://api.llama.fi";
  private readonly pricesUrl = "https://coins.llama.fi";

  constructor() {
    super("defillama", []);
  }

  @CreateAction({
    name: "get_token_prices",
    description:
      "Get current token prices from DefiLlama. Tokens should be provided with chain prefix, e.g., 'ethereum:0x...'",
    schema: GetTokenPricesSchema,
  })
  async getTokenPrices(args: z.infer<typeof GetTokenPricesSchema>): Promise<string> {
    try {
      const searchParams = new URLSearchParams({
        coins: args.tokens.join(","),
      });
      if (args.searchWidth) {
        searchParams.append("searchWidth", args.searchWidth);
      }

      const url = `${this.pricesUrl}/prices/current/${searchParams.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error fetching token prices: ${error}`;
    }
  }

  @CreateAction({
    name: "get_protocol",
    description: "Get detailed information about a specific protocol from DefiLlama",
    schema: GetProtocolSchema,
  })
  async getProtocol(args: z.infer<typeof GetProtocolSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/protocol/${args.protocolId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error fetching protocol information: ${error}`;
    }
  }

  @CreateAction({
    name: "search_protocols",
    description: "Search for protocols on DefiLlama",
    schema: SearchProtocolsSchema,
  })
  async searchProtocols(args: z.infer<typeof SearchProtocolsSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/protocols`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const protocols = await response.json();
      const searchResults = protocols.filter((protocol: any) =>
        protocol.name.toLowerCase().includes(args.query.toLowerCase()),
      );

      if (searchResults.length === 0) {
        return `No protocols found matching "${args.query}"`;
      }

      return JSON.stringify(searchResults, null, 2);
    } catch (error) {
      return `Error searching protocols: ${error}`;
    }
  }

  supportsNetwork = () => true;
}

export const defillamaActionProvider = () => new DefiLlamaActionProvider();
