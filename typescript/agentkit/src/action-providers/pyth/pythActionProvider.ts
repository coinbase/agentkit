import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { PythFetchPriceFeedIDSchema, PythFetchPriceSchema } from "./schemas";

/**
 * PythActionProvider is an action provider for Pyth.
 */
export class PythActionProvider extends ActionProvider {
  /**
   * Constructs a new PythActionProvider.
   */
  constructor() {
    super("pyth", []);
  }

  /**
   * Fetch the price feed ID for a given token symbol from Pyth.
   *
   * @param args - The arguments for the action.
   * @returns The price feed ID as stringified JSON.
   */
  @CreateAction({
    name: "fetch_price_feed",
    description: `Fetch the price feed ID for a given token symbol from Pyth.

    Inputs:
    - tokenSymbol: The asset ticker/symbol to fetch the price feed ID for (e.g. BTC, ETH, COIN, XAU, EUR, etc.)
    - quoteCurrency: The quote currency to filter by (defaults to USD)
    - assetType: The asset type to search for (crypto, equity, fx, metal) - defaults to crypto

    Examples:
    - Crypto: BTC, ETH, SOL
    - Equities: COIN, AAPL, TSLA
    - FX: EUR, GBP, JPY
    - Metals: XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)
    `,
    schema: PythFetchPriceFeedIDSchema,
  })
  async fetchPriceFeed(args: z.infer<typeof PythFetchPriceFeedIDSchema>): Promise<string> {
    const url = `https://hermes.pyth.network/v2/price_feeds?query=${args.tokenSymbol}&asset_type=${args.assetType}`;
    const response = await fetch(url);

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: `HTTP error! status: ${response.status}`,
      });
    }

    const data = await response.json();

    if (data.length === 0) {
      return JSON.stringify({
        success: false,
        error: `No price feed found for ${args.tokenSymbol}`,
      });
    }

    const filteredData = data.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) =>
        item.attributes.base.toLowerCase() === args.tokenSymbol.toLowerCase() &&
        item.attributes.quote_currency.toLowerCase() === args.quoteCurrency.toLowerCase(),
    );

    if (filteredData.length === 0) {
      return JSON.stringify({
        success: false,
        error: `No price feed found for ${args.tokenSymbol}/${args.quoteCurrency}`,
      });
    }

    // For equities, select the regular feed over special market hours feeds
    let selectedFeed = filteredData[0];
    if (args.assetType === "equity") {
      // Look for regular market feed (no PRE, POST, ON, EXT suffixes)
      const regularMarketFeed = filteredData.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) =>
          !item.attributes.symbol.includes(".PRE") &&
          !item.attributes.symbol.includes(".POST") &&
          !item.attributes.symbol.includes(".ON") &&
          !item.attributes.symbol.includes(".EXT"),
      );

      if (regularMarketFeed) {
        selectedFeed = regularMarketFeed;
      }
    }

    return JSON.stringify({
      success: true,
      priceFeedID: selectedFeed.id,
      tokenSymbol: args.tokenSymbol,
      quoteCurrency: args.quoteCurrency,
      feedType: selectedFeed.attributes.display_symbol,
    });
  }

  /**
   * Fetches the price from Pyth given a Pyth price feed ID.
   *
   * @param args - The arguments for the action.
   * @returns The price as stringified JSON.
   */
  @CreateAction({
    name: "fetch_price",
    description: `Fetch the price of a price feed from Pyth.

Inputs:
- priceFeedID: Price feed ID (string)

Important notes:
- Do not assume that a random ID is a Pyth price feed ID. If you are confused, ask a clarifying question.
- This action only fetches price inputs from Pyth price feeds. No other source.
- If you are asked to fetch the price from Pyth for a ticker symbol such as BTC, you must first use the pyth_fetch_price_feed_id
action to retrieve the price feed ID before invoking the pyth_fetch_price action
`,
    schema: PythFetchPriceSchema,
  })
  async fetchPrice(args: z.infer<typeof PythFetchPriceSchema>): Promise<string> {
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${args.priceFeedID}`;
    const response = await fetch(url);

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: `HTTP error! status: ${response.status}`,
      });
    }

    const data = await response.json();
    const parsedData = data.parsed;

    if (parsedData.length === 0) {
      return JSON.stringify({
        success: false,
        error: `No price data found for ${args.priceFeedID}`,
      });
    }

    // Helper function to format price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatPrice = (priceInfo: any): string => {
      const price = BigInt(priceInfo.price);
      const exponent = priceInfo.expo;

      if (exponent < 0) {
        const adjustedPrice = price * BigInt(100);
        const divisor = BigInt(10) ** BigInt(-exponent);
        const scaledPrice = adjustedPrice / BigInt(divisor);
        const priceStr = scaledPrice.toString();
        const formattedPrice = `${priceStr.slice(0, -2)}.${priceStr.slice(-2)}`;
        return formattedPrice.startsWith(".") ? `0${formattedPrice}` : formattedPrice;
      }

      const scaledPrice = price / BigInt(10) ** BigInt(exponent);
      return scaledPrice.toString();
    };

    const priceInfo = parsedData[0].price;
    return JSON.stringify({
      success: true,
      priceFeedID: args.priceFeedID,
      price: formatPrice(priceInfo),
    });
  }

  /**
   * Checks if the Pyth action provider supports the given network.
   *
   * @returns True if the Pyth action provider supports the network, false otherwise.
   */
  supportsNetwork = () => true;
}

export const pythActionProvider = () => new PythActionProvider();
