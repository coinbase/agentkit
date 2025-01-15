import { AlloraAction } from "./allora_action";
import {
  AlloraAPIClient,
  PriceInferenceTimeframe,
  PriceInferenceToken,
} from "@alloralabs/allora-sdk";
import { z } from "zod";

const GET_PRICE_INFERENCE_PROMPT = `
This tool will get the future price inference for a given crypto asset from Allora Network.
It takes the crypto asset and timeframe as inputs.
`;

/**
 * Input schema for get price inference action.
 */
export const GetPriceInferenceInput = z
  .object({
    asset: z.string().describe("The crypto asset to get the price inference for, e.g. 'BTC'"),
    timeframe: z
      .string()
      .describe("The timeframe to get the price inference for, e.g. '5m' or '8h'"),
  })
  .strip()
  .describe("Instructions for getting the price inference");

/**
 * Gets the future price inference for a given crypto asset from Allora Network.
 *
 * @param client - The Allora API client.
 * @param args - A zod object containing the asset and timeframe.
 * @returns A message containing the price inference.
 */
export async function getPriceInference(
  client: AlloraAPIClient,
  args: z.infer<typeof GetPriceInferenceInput>,
): Promise<string> {
  const getPriceInferenceArgs = {
    asset: args.asset,
    timeframe: args.timeframe,
  };

  try {
    const asset = getPriceInferenceArgs.asset as PriceInferenceToken;
    const timeframe = getPriceInferenceArgs.timeframe as PriceInferenceTimeframe;

    const priceInference = await client.getPriceInference(asset, timeframe);

    return `The future price inference for ${asset} in ${timeframe} is ${priceInference.inference_data.network_inference_normalized}`;
  } catch (error) {
    return `Error getting price inference: ${error}`;
  }
}

/**
 * Get price inference action.
 */
export class GetPriceInferenceAction implements AlloraAction<typeof GetPriceInferenceInput> {
  public name = "get_price_inference";
  public description = GET_PRICE_INFERENCE_PROMPT;
  public argsSchema = GetPriceInferenceInput;
  public func = getPriceInference;
}
