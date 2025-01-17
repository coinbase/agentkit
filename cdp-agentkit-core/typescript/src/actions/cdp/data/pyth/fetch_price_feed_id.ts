import { CdpAction } from "../../cdp_action";
import { z } from "zod";

const PYTH_FETCH_PRICE_FEED_ID_PROMPT = `
Fetch the price feed ID for a given token symbol from Pyth.
`;

/**
 * Input schema for Pyth fetch price feed ID action.
 */
export const PythFetchPriceFeedIDInput = z.object({
  tokenSymbol: z.string().describe("The token symbol to fetch the price feed ID for"),
});

/**
 * Fetches the price feed ID from Pyth given a ticker symbol.
 *
 * @param args - The input arguments for the action.
 * @returns A message containing the price feed ID corresponding to the given ticker symbol.
 */
export async function pythFetchPriceFeedID(
  args: z.infer<typeof PythFetchPriceFeedIDInput>,
): Promise<string> {
  const url = `https://hermes.pyth.network/v2/price_feeds?query=${args.tokenSymbol}&asset_type=crypto`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (data.length === 0) {
    throw new Error(`No price feed found for ${args.tokenSymbol}`);
  }

  const filteredData = data.filter(
    (item: any) => item.attributes.base.toLowerCase() === args.tokenSymbol.toLowerCase(),
  );

  if (filteredData.length === 0) {
    throw new Error(`No price feed found for ${args.tokenSymbol}`);
  }

  return filteredData[0].id;
}

/**
 * Pyth fetch price feed ID action.
 */
export class PythFetchPriceFeedIDAction implements CdpAction<typeof PythFetchPriceFeedIDInput> {
  public name = "pyth_fetch_price_feed_id";
  public description = PYTH_FETCH_PRICE_FEED_ID_PROMPT;
  public argsSchema = PythFetchPriceFeedIDInput;
  public func = pythFetchPriceFeedID;
}
