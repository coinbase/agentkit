import { z } from "zod";

/**
 * Input schema for Pyth fetch price feed ID action.
 */
export const PythFetchPriceFeedIDSchema = z
  .object({
    tokenSymbol: z.string().describe("The token symbol to fetch the price feed ID for"),
  })
  .strict();

/**
 * Input schema for Pyth fetch price action.
 */
export const PythFetchPriceSchema = z
  .object({
    priceFeedID: z.string().describe("The price feed ID to fetch the price for"),
  })
  .strict();
