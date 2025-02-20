import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { AlchemyTokenPricesBySymbolSchema, AlchemyTokenPricesByAddressSchema } from "./schemas";

/**
 * Configuration options for the AlchemyTokenPricesActionProvider.
 */
export interface AlchemyTokenPricesActionProviderConfig {
  /**
   * Alchemy API Key
   */
  apiKey?: string;
}

/**
 * AlchemyTokenPricesActionProvider is an action provider for fetching token prices via the Alchemy Prices API.
 * This provider enables querying current and historical token prices using symbols or addresses.
 *
 */
export class AlchemyTokenPricesActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Creates a new instance of AlchemyTokenPricesActionProvider
   *
   * @param config - Configuration options including the API key
   */
  constructor(config: AlchemyTokenPricesActionProviderConfig = {}) {
    super("alchemyTokenPrices", []);

    config.apiKey ||= process.env.ALCHEMY_API_KEY;
    if (!config.apiKey) {
      throw new Error("ALCHEMY_API_KEY is not configured.");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = "https://api.g.alchemy.com/prices/v1";
  }

  /**
   * Fetch current token prices for one or more token symbols.
   *
   * @param args - The arguments containing an array of token symbols.
   * @returns A JSON string with the token prices or an error message.
   */
  @CreateAction({
    name: "token_prices_by_symbol",
    description: `
This tool will fetch current prices for one or more tokens using their symbols via the Alchemy Prices API.

A successful response will return a JSON payload similar to:
{
  "data": [
    {
      "symbol": "ETH",
      "prices": [
        {
          "currency": "usd",
          "value": "2873.490923459",
          "lastUpdatedAt": "2025-02-03T23:46:40Z"
        }
      ]
    }
  ]
}

A failure response will return an error message with details.
    `,
    schema: AlchemyTokenPricesBySymbolSchema,
  })
  async tokenPricesBySymbol(
    args: z.infer<typeof AlchemyTokenPricesBySymbolSchema>,
  ): Promise<string> {
    try {
      // Build query parameters: for each symbol add a separate query parameter
      const params = new URLSearchParams();
      for (const symbol of args.symbols) {
        params.append("symbols", symbol);
      }

      const url = `${this.baseUrl}/${this.apiKey}/tokens/by-symbol?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return `Successfully fetched token prices by symbol:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
      return `Error fetching token prices by symbol: ${error}`;
    }
  }

  /**
   * Fetch current token prices for one or more tokens identified by network and address pairs.
   *
   * @param args - The arguments containing an array of token network/address pairs.
   * @returns A JSON string with the token prices or an error message.
   */
  @CreateAction({
    name: "token_prices_by_address",
    description: `
This tool will fetch current prices for tokens using network and address pairs via the Alchemy Prices API.

A successful response will return a JSON payload similar to:
{
  "data": [
    {
      "network": "eth-mainnet",
      "address": "0xYourTokenAddress",
      "prices": [
        {
          "currency": "usd",
          "value": "1234.56",
          "lastUpdatedAt": "2025-02-03T23:46:40Z"
        }
      ]
    }
  ]
}

A failure response will return an error message with details.
    `,
    schema: AlchemyTokenPricesByAddressSchema,
  })
  async tokenPricesByAddress(
    args: z.infer<typeof AlchemyTokenPricesByAddressSchema>,
  ): Promise<string> {
    try {
      const url = `${this.baseUrl}/${this.apiKey}/tokens/by-address`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return `Successfully fetched token prices by address:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
      return `Error fetching token prices by address: ${error}`;
    }
  }

  /**
   * Checks if the Alchemy Prices action provider supports the given network.
   * Since the API works with multiple networks, this always returns true.
   *
   * @returns Always returns true.
   */
  supportsNetwork = (): boolean => {
    return true;
  };
}

/**
 * Factory function to create a new AlchemyTokenPricesActionProvider instance.
 *
 * @param config - The configuration options for the provider.
 * @returns A new instance of AlchemyTokenPricesActionProvider.
 */
export const alchemyTokenPricesActionProvider = (config?: AlchemyTokenPricesActionProviderConfig) =>
  new AlchemyTokenPricesActionProvider(config);
