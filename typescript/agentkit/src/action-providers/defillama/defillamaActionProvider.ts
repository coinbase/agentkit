import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { GetTokenPricesSchema, GetProtocolSchema, SearchProtocolsSchema } from "./schemas";
import { DEFILLAMA_BASE_URL, DEFILLAMA_PRICES_URL } from "./constants";
import { Protocol, ProtocolResponse } from "./types";
import { pruneGetProtocolResponse } from "./utils";

/**
 * DefiLlamaActionProvider is an action provider for DefiLlama API interactions.
 * Provides functionality to fetch token prices, protocol information, and search protocols.
 */
export class DefiLlamaActionProvider extends ActionProvider {
  /**
   * Constructor for the DefiLlamaActionProvider class.
   */
  constructor() {
    super("defillama", []);
  }

  /**
   * Searches for protocols on DefiLlama.
   * Note: This performs a case-insensitive search on protocol names.
   * Returns all protocols whose names contain the search query.
   *
   * @param args - The protocol search parameters
   * @returns A JSON string containing matching protocols or error message
   */
  @CreateAction({
    name: "find_protocol",
    description: `This tool will search for DeFi protocols on DefiLlama by name.
It takes the following inputs:
- A search query string to match against protocol names

Important notes:
- The search is case-insensitive
- Returns all protocols whose names contain the search query
- Returns metadata including TVL, chain, category, and other protocol details
- Returns a "No protocols found" message if no matches are found`,
    schema: SearchProtocolsSchema,
  })
  async searchProtocols(args: z.infer<typeof SearchProtocolsSchema>): Promise<string> {
    try {
      const url = `${DEFILLAMA_BASE_URL}/protocols`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const protocols = await response.json();
      const searchResults = protocols.filter((protocol: Protocol) =>
        protocol.name.toLowerCase().includes(args.query.toLowerCase()),
      );

      if (searchResults.length === 0) {
        return `No protocols found matching "${args.query}"`;
      }

      return JSON.stringify(searchResults, null, 2);
    } catch (error: unknown) {
      return `Error searching protocols: ${error}`;
    }
  }

  /**
   * Gets detailed information about a specific protocol.
   * Note: Returns null if the protocol is not found.
   * The response includes TVL, description, category, and other metadata.
   * Time-series data is pruned to keep response size manageable.
   *
   * @param args - The protocol request parameters
   * @returns A JSON string containing time-series pruned protocol information
   */
  @CreateAction({
    name: "get_protocol",
    description: `This tool will fetch detailed information about a specific protocol from DefiLlama.
It takes the following inputs:
- The protocol identifier from DefiLlama (e.g. uniswap)

Important notes:
- Returns null if the protocol is not found
- Returns comprehensive data including TVL, description, category, and other metadata
- Includes historical TVL data and chain-specific breakdowns where available
- Returns error message if the protocol ID is invalid or the request fails
- Prunes time-series data to 5 most recent entries to make the response more manageable`,
    schema: GetProtocolSchema,
  })
  async getProtocol(args: z.infer<typeof GetProtocolSchema>): Promise<string> {
    try {
      const url = `${DEFILLAMA_BASE_URL}/protocol/${args.protocolId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ProtocolResponse;
      const prunedData = pruneGetProtocolResponse(data);

      return JSON.stringify(prunedData, null, 2);
    } catch (error: unknown) {
      return `Error fetching protocol information: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets current token prices from DefiLlama.
   * Note: Token addresses must include chain prefix (e.g., 'ethereum:0x...')
   * The searchWidth parameter can be used to specify a time range in minutes.
   *
   * @param args - The token price request parameters
   * @returns A JSON string containing token prices or error message
   */
  @CreateAction({
    name: "get_token_prices",
    description: `This tool will fetch current token prices from DefiLlama.
It takes the following inputs:
- An array of token addresses with chain prefixes
- Optional time range in minutes for historical prices

Important notes:
- Token addresses MUST include chain prefix (e.g., 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
- The searchWidth parameter is optional, it's default api value is '4h', leave this blank if unspecified
- Returns current prices for all specified tokens
- Returns error message if any token address is invalid or the request fails`,
    schema: GetTokenPricesSchema,
  })
  async getTokenPrices(args: z.infer<typeof GetTokenPricesSchema>): Promise<string> {
    try {
      const params = new URLSearchParams({});
      const tokens = args.tokens.join(",");

      if (args.searchWidth) {
        params.set("searchWidth", args.searchWidth);
      }

      const url = `${DEFILLAMA_PRICES_URL}/prices/current/${tokens}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching token prices: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the DefiLlama action provider supports the given network.
   * DefiLlama is network-agnostic, so this always returns true.
   *
   * @returns True, as DefiLlama actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the DefiLlama action provider.
 *
 * @returns A new DefiLlamaActionProvider instance
 */
export const defillamaActionProvider = () => new DefiLlamaActionProvider();
