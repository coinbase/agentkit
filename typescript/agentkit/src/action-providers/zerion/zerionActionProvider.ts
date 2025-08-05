import { isAddress } from "viem";
import { z } from "zod";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { ZERION_V1_BASE_URL } from "./constants";
import { GetWalletPortfolioSchema } from "./schemas";
import { ZerionFungiblePositionsResponse, ZerionPortfolioResponse } from "./types";
import { formatPortfolioData, formatPositionsData } from "./utils";

/**
 * Configuration options for the ZerionActionProvider.
 */
export interface ZerionActionProviderConfig {
  /**
   * Zerion API Key. Request new at https://zerion.io/api
   */
  apiKey?: string;
}

/**
 * ZerionActionProvider provides actions for zerion operations.
 *
 * @description
 * This provider is designed to provide blockchain-agnostic operations.
 * It supports all blockchain networks.
 */
export class ZerionActionProvider extends ActionProvider {
  private readonly apiKey: string;

  /**
   * Constructor for the ZerionActionProvider.
   *
   * @param config - The configuration options for the ZerionActionProvider.
   */
  constructor(config: ZerionActionProviderConfig = {}) {
    super("zerion", []);

    const apiKey = config.apiKey || process.env.ZERION_API_KEY;
    if (!apiKey) {
      throw new Error("ZERION_API_KEY is not configured.");
    }
    const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");
    this.apiKey = encodedKey;
  }

  /**
   * Fetches and summarizes a crypto wallet's portfolio in USD.
   *
   * @param args - Arguments defined by GetWalletPortfolioSchema
   * @returns A promise that resolves to a string describing the action result
   */
  @CreateAction({
    name: "get_portfolio_overview",
    description: `
    Fetches and summarizes a crypto wallet's portfolio in USD. 
    The tool returns a human-readable overview of the wallet's total value, value distribution across blockchains, position types (e.g., staked, deposited), and 24-hour performance change. 
    Useful for providing quick insights into a wallet's DeFi and cross-chain holdings.
    Input:
    - walletAddress: The wallet address to fetch portfolio overview for.
    Output a structured text summary with:
    - Total portfolio value in USD
    - 24h percentage change in value
    - Breakdown of value by position types (e.g., wallet, deposited, staked, locked, borrowed)
    - Top 5 chains by value distribution
  `,
    schema: GetWalletPortfolioSchema,
  })
  async getPortfolioOverview(args: z.infer<typeof GetWalletPortfolioSchema>): Promise<string> {
    try {
      const address = args.walletAddress || "";
      if (!isAddress(address)) {
        return `Invalid wallet address: ${address}`;
      }
      const options = {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${this.apiKey}`,
        },
      };

      const url = `${ZERION_V1_BASE_URL}/wallets/${args.walletAddress}/portfolio?filter[positions]=no_filter&currency=usd`;
      const response = await fetch(url, options);
      const { data }: ZerionPortfolioResponse = await response.json();

      return formatPortfolioData(data);
    } catch (error) {
      return `Error fetching portfolio overview for wallet ${args.walletAddress}: ${error}`;
    }
  }

  /**
   * Retrieves and summarizes a wallet's fungible token holdings.
   *
   * @param args - Arguments defined by GetWalletPortfolioSchema
   * @returns A promise that resolves to a string describing the action result
   */
  @CreateAction({
    name: "get_fungible_positions",
    description: `
    Retrieves and summarizes a wallet's fungible token holdings. 
    For each token, it includes metadata such as symbol, name, holding value, associated protocol (if applicable), and the type of position (e.g., deposit, wallet, reward). 
    The summary also reports the total USD value of all qualifying token positions.
    Input:
    - walletAddress: The wallet address to fetch fungible positions for.
    Output a readable text summary including:
    - All token positions
    - For each: token name, symbol, USD value, chain, position type
    - If applicable: protocol used and type of action (e.g. staked, deposited via protocol)
    - A final total value in USD across all included positions
  `,
    schema: GetWalletPortfolioSchema,
  })
  async getFungiblePositions(args: z.infer<typeof GetWalletPortfolioSchema>): Promise<string> {
    try {
      const address = args.walletAddress || "";
      if (!isAddress(address)) {
        return `Invalid wallet address: ${address}`;
      }

      const options = {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${this.apiKey}`,
        },
      };

      const url = `${ZERION_V1_BASE_URL}/wallets/${args.walletAddress}/positions?filter[positions]=no_filter&currency=usd&filter[trash]=only_non_trash&sort=value`;
      const response = await fetch(url, options);
      const { data }: ZerionFungiblePositionsResponse = await response.json();

      return formatPositionsData(data);
    } catch (error) {
      return `Error fetching fungible positions for wallet ${args.walletAddress}: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // all protocol networks
    return network.protocolFamily === "evm";
  }
}

/**
 * Factory function to create a new ZerionActionProvider instance.
 *
 * @param config - The configuration options for the ZerionActionProvider.
 * @returns A new ZerionActionProvider instance
 */
export const zerionActionProvider = (config?: ZerionActionProviderConfig) =>
  new ZerionActionProvider(config);
