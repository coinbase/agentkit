/**
 * Dexpaprika Action Provider
 *
 * This file contains the implementation of the DexpaprikaActionProvider,
 * which provides actions for dexpaprika operations.
 *
 * @module dexpaprika
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  getDexPoolsSchema,
  getNetworkDexesSchema,
  getNetworkPoolsSchema,
  getPoolDetailsSchema,
  getTokenDetailsSchema,
  getTopPoolsSchema,
  searchSchema,
} from "./schemas";

/**
 * DexpaprikaActionProvider provides actions for dexpaprika operations.
 *
 * @description
 * This provider is designed to work with WalletProvider for blockchain interactions.
 * It supports all blockchain networks.
 */
export class DexpaprikaActionProvider extends ActionProvider {
  /**
   * Creates a new instance of DexpaprikaActionProvider.
   */
  constructor() {
    super("dexpaprika", []);
  }

  /**
   * Fetches top pools on a specific DEX within a network
   *
   * @param args - The arguments for fetching DEX pools
   * @returns A JSON string containing DEX pool information
   */
  @CreateAction({
    name: "get_dex_pools",
    description: "Get top pools on a specific DEX within a network",
    schema: getDexPoolsSchema,
  })
  async getDexPools(args: z.infer<typeof getDexPoolsSchema>): Promise<string> {
    const response = await fetch(
      `https://api.dexpaprika.com/networks/${args.network}/dexes/${args.dex}/pools?sort=${args.sort}&order_by=${args.order_by}&limit=5`,
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Gets a list of available decentralized exchanges on a specific network.
   *
   * @param args - The arguments for fetching network DEXes
   * @returns A JSON string containing network DEX information
   */
  @CreateAction({
    name: "get_network_dexes",
    description: "Get a list of available decentralized exchanges on a specific network",
    schema: getNetworkDexesSchema,
  })
  async getNetworkDexes(args: z.infer<typeof getNetworkDexesSchema>): Promise<string> {
    const response = await fetch(
      `https://api.dexpaprika.com/networks/${args.network}/dexes?limit=5`,
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Gets a list of top liquidity pools on a specific network.
   *
   * @param args - The arguments for fetching network pools
   * @returns A JSON string containing network pool information
   */
  @CreateAction({
    name: "get_network_pools",
    description: "Get a list of top liquidity pools on a specific network",
    schema: getNetworkPoolsSchema,
  })
  async getNetworkPools(args: z.infer<typeof getNetworkPoolsSchema>): Promise<string> {
    const response = await fetch(
      `https://api.dexpaprika.com/networks/${args.network}/pools?limit=5`,
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Gets detailed information about a specific pool on a network.
   *
   * @param args - The arguments for fetching pool details
   * @returns A JSON string containing pool details
   */
  @CreateAction({
    name: "get_pool_details",
    description: "Get detailed information about a specific pool on a network",
    schema: getPoolDetailsSchema,
  })
  async getPoolDetails(args: z.infer<typeof getPoolDetailsSchema>): Promise<string> {
    const response = await fetch(
      `https://api.dexpaprika.com/networks/${args.network}/pools/${args.pool_address}`,
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Gets detailed information about a specific token on a network.
   *
   * @param args - The arguments for fetching token details
   * @returns A JSON string containing token details
   */
  @CreateAction({
    name: "get_token_details",
    description: "Get detailed information about a specific token on a network",
    schema: getTokenDetailsSchema,
  })
  async getTokenDetails(args: z.infer<typeof getTokenDetailsSchema>): Promise<string> {
    const response = await fetch(
      `https://api.dexpaprika.com/networks/${args.network}/tokens/${args.token_address}`,
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Gets a paginated list of top liquidity pools from all networks.
   *
   * @param _ - The arguments for fetching top pools (not used in implementation)
   * @returns A JSON string containing top pools information
   */
  @CreateAction({
    name: "get_top_pools",
    description: "Get a paginated list of top liquidity pools from all networks",
    schema: getTopPoolsSchema,
  })
  async getTopPools(_: z.infer<typeof getTopPoolsSchema>): Promise<string> {
    const response = await fetch(
      "https://api.dexpaprika.com/pools?limit=10&page=0&sort=desc&order_by=volume_usd",
      { method: "GET" },
    );
    return response.json();
  }

  /**
   * Searches for information about tokens using a provided query.
   *
   * @param args - The search query arguments
   * @returns A JSON string containing search results
   */
  @CreateAction({
    name: "search",
    description:
      "Search information about token using provided query in the form of token ticker or contract address ex. 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 in Dexpaprika API",
    schema: searchSchema,
  })
  async search(args: z.infer<typeof searchSchema>): Promise<string> {
    const response = await fetch("https://api.dexpaprika.com/search/?query=" + args.query, {
      method: "GET",
    });
    return response.json();
  }

  /**
   * Checks if the provider supports a specific network.
   *
   * @returns Always returns true as this provider supports all networks
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Factory function to create a new DexpaprikaActionProvider instance.
 *
 * @returns A new DexpaprikaActionProvider instance
 */
export const dexpaprikaActionProvider = () => new DexpaprikaActionProvider();
