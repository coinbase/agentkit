import { z } from "zod";

/**
 * Input schema for get pairs by chain and pair schema action.
 */
export const GetPairsByChainAndPairSchema = z
  .object({
    chainId: z.string().describe("The chain ID of the pair"),
    pairId: z.string().describe("The pair ID to fetch"),
  })
  .strict();

/**
 * Input schema for get token pairs schema action.
 */
export const GetTokenPairsSchema = z
  .object({
    chainId: z.string().describe("The chain ID of the pair"),
    tokenAddresses: z.array(z.string()).describe("List of the token addresses"),
  })
  .strict();

/**
 * Input schema for search pairs schema action.
 */
export const SearchPairsSchema = z
  .object({
    query: z.string().describe("The search query string"),
  })
  .strict();
