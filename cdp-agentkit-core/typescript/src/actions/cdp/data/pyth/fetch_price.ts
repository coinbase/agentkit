import { CdpAction } from "../../cdp_action";
import { z } from "zod";

const PYTH_FETCH_PRICE_PROMPT = `
Fetch the price of a given price feed from Pyth.

Inputs:
- Pyth price feed ID

Important notes:
- Do not assume that a random ID is a Pyth price feed ID. If you are confused, ask a clarifying question.
- This action only fetches price inputs from Pyth price feeds. No other source.
- If you are asked to fetch the price from Pyth for a ticker symbol such as BTC, you must first use the pyth_fetch_price_feed_id
action to retrieve the price feed ID before invoking the pyth_Fetch_price action
`;

/**
 * Input schema for Pyth fetch price action.
 */
export const PythFetchPriceInput = z.object({
  priceFeedID: z.string().describe("The price feed ID to fetch the price for"),
});

/**
 * Fetches the price from Pyth given a Pyth price feed ID.
 *
 * @param args - The input arguments for the action.
 * @returns A message containing the price from the given price feed.
 */
export async function pythFetchPrice(args: z.infer<typeof PythFetchPriceInput>): Promise<string> {
  const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${args.priceFeedID}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const parsedData = data.parsed;

  if (parsedData.length === 0) {
    throw new Error(`No price data found for ${args.priceFeedID}`);
  }

  const priceInfo = parsedData[0].price;
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
}

/**
 * Pyth fetch price action.
 */
export class PythFetchPriceAction implements CdpAction<typeof PythFetchPriceInput> {
  public name = "pyth_fetch_price";
  public description = PYTH_FETCH_PRICE_PROMPT;
  public argsSchema = PythFetchPriceInput;
  public func = pythFetchPrice;
}
