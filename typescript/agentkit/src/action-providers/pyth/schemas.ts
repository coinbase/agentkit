import { z } from "zod";

/**
 * Input schema for Pyth fetch price feed ID action.
 */
export const PythFetchPriceFeedIDSchema = z
  .object({
    tokenSymbol: z.string().describe("The asset ticker/symbol to fetch the price feed ID for"),
    quoteCurrency: z
      .string()
      .default("USD")
      .describe("The quote currency to filter by (defaults to USD)"),
    assetType: z
      .enum(["crypto", "equity", "fx", "metal"])
      .default("crypto")
      .describe("The asset type to search for (crypto, equity, fx, metal)"),
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
