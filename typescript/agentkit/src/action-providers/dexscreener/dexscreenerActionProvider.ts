import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { GetPairsByChainAndPairSchema, GetTokenPairsSchema, SearchPairsSchema } from "./schemas";

/**
 * DexscreenerActionProvider is an action provider for Dexscreener.
 */
export class DexscreenerActionProvider extends ActionProvider {
  /**
   * Constructs a new DexscreenerActionProvider.
   */
  constructor() {
    super("dexscreener", []);
  }

  /**
   * Get pairs by chainId and pairId from Dexscreener
   *
   * @param args - The arguments for the action.
   * @returns The array of token pairs.
   */
  @CreateAction({
    name: "get_pairs_by_chain_and_pair",
    description: "Get pairs by chainId and pairId from Dexscreener",
    schema: GetPairsByChainAndPairSchema
  })
  async getPairsByChainAndPair(args: z.infer<typeof GetPairsByChainAndPairSchema>): Promise<string> {
    const url = `https://api.dexscreener.com/latest/dex/pairs/${args.chainId}/${args.pairId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tokenPair = await response.json();
    const pairs = tokenPair.pairs
    if (pairs.length === 0) {
      throw new Error(`No pairs found for chainId: ${args.chainId} / pairId: ${args.pairId}`);
    }
    return JSON.stringify(pairs)
  }

  /**
   * Get all token pairs for given token addresses from Dexscreener
   *
   * @param args - The arguments for the action.
   * @returns The array of multiple token pairs by token address.
   */
  @CreateAction({
    name: "get_token_pairs_by_token_address",
    description: "Get all token pairs for given token addresses from Dexscreener",
    schema: GetTokenPairsSchema
  })
  async getTokenPairsByTokenAddress(args: z.infer<typeof GetTokenPairsSchema>): Promise<string> {
    const addresses = args.tokenAddresses.join(",");
    const url = `https://api.dexscreener.com/tokens/v1/${args.chainId}/${addresses}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const pairs = await response.json();
    return JSON.stringify(pairs)
  }

  /**
   * Search for pairs matching a query string on Dexscreener
   *
   * @param args - The arguments for the action.
   * @returns The array of token pairs.
   */
  @CreateAction({
    name: "search_pairs",
    description: "Search for pairs matching a query string on Dexscreener",
    schema: SearchPairsSchema
  })
  async searchPairs(args: z.infer<typeof SearchPairsSchema>): Promise<string> {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(args.query)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tokenPair = await response.json();
    const pairs = tokenPair.pairs
    if (pairs.length === 0) {
      throw new Error(`No token pair found for ${args.query}`);
    }
    return JSON.stringify(pairs)
  }

  /**
   * Checks if the Dexscreener action provider supports the given network.
   *
   * @returns True if the Dexscreener action provider supports the network, false otherwise.
   */
  supportsNetwork = () => true;

}

export const dexscreenerActionProvider = () => new DexscreenerActionProvider();