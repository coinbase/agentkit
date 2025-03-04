import { z } from "zod";

/**
 * Input schema for getting protocol information
 */
export const GetProtocolSchema = z
  .object({
    protocolId: z.string().describe("The protocol identifier from DefiLlama"),
  })
  .strict();

/**
 * Input schema for getting token prices
 */
export const GetTokenPricesSchema = z
  .object({
    tokens: z
      .array(z.string())
      .describe("Array of token addresses with chain prefix, e.g., ['ethereum:0x...']"),
    searchWidth: z
      .string()
      .optional()
      .describe("Optional time range in minutes to search for prices, default api value is '4h'"),
  })
  .strict();

/**
 * Input schema for searching protocols
 */
export const SearchProtocolsSchema = z
  .object({
    query: z.string().describe("Search query to find protocols"),
  })
  .strict();
