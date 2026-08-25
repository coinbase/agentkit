// typescript/agentkit/src/action-providers/carv/carvActionProvider.ts

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  CarvGetAddressByDiscordIdSchema,
  CarvGetAddressByTwitterIdSchema,
  CarvGetBalanceByDiscordIdSchema,
  CarvGetBalanceByTwitterIdSchema,
} from "./schemas";

/**
 * Configuration options for the CarvActionProvider.
 */
export interface CarvActionProviderConfig {
  /**
   * CARV API Key for authentication
   */
  apiKey?: string;

  /**
   * Base API URL (defaults to CARV production API)
   */
  apiBaseUrl?: string;
}

/**
 * Response interface for CARV API
 */
interface CarvApiResponse {
  code: number;
  msg: string;
  data: {
    balance: string;
    user_address: string;
  };
}

/**
 * CarvActionProvider is an action provider for CARV ID lookups.
 *
 * @augments ActionProvider
 */
export class CarvActionProvider extends ActionProvider {
  private config: CarvActionProviderConfig;
  private readonly DEFAULT_API_URL = "https://interface.carv.io/ai-agent-backend";

  /**
   * Constructor for the CarvActionProvider class.
   *
   * @param config - The configuration options for the CarvActionProvider
   */
  constructor(config: CarvActionProviderConfig = {}) {
    super("carv", []);

    this.config = { ...config };

    // Set defaults from environment variables
    this.config.apiKey ||= process.env.CARV_API_KEY;
    this.config.apiBaseUrl ||= this.DEFAULT_API_URL;

    // Validate config
    if (!this.config.apiKey) {
      throw new Error("CARV_API_KEY is not configured.");
    }
  }

  /**
   * Make a request to the CARV API
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, string>
  ): Promise<{ success: boolean; data?: CarvApiResponse; error?: string }> {
    try {
      const url = new URL(`${this.config.apiBaseUrl}${endpoint}`);
      
      // Add query parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
  
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: this.config.apiKey!,
        },
      });
  
      if (!response.ok) {
        return {
          success: false,
          error: `CARV API Error ${response.status}: ${response.statusText}`,
        };
      }
  
      // 👇 使用 as 进行类型断言
      const data = await response.json() as CarvApiResponse;
  
      if (data.code !== 0) {
        return {
          success: false,
          error: `CARV API Error: ${data.msg}`,
        };
      }
  
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get user wallet address by Discord ID.
   *
   * @param args - The arguments containing Discord user ID and optional chain/token
   * @returns A JSON string containing the user's wallet address or error message
   */
  @CreateAction({
    name: "get_address_by_discord_id",
    description: `
This tool retrieves a user's wallet address using their Discord ID.

A successful response will return:
    {
      "user_address": "0xacf85e57cfff872a076ec1e5350fd959d08763db",
      "balance": "21.585240",
      "chain_name": "base",
      "token_ticker": "carv"
    }

A failure response will return an error message:
    Error retrieving address: User not found`,
    schema: CarvGetAddressByDiscordIdSchema,
  })
  async getAddressByDiscordId(
    args: z.infer<typeof CarvGetAddressByDiscordIdSchema>
  ): Promise<string> {
    const result = await this.makeRequest("/user_balance_by_discord_id", {
      discord_user_id: args.discordUserId,
      chain_name: args.chainName || "base",
      token_ticker: args.tokenTicker || "carv",
    });

    if (result.success && result.data) {
      return `Successfully retrieved user address by Discord ID:\n${JSON.stringify(
        {
          user_address: result.data.data.user_address,
          balance: result.data.data.balance,
          chain_name: args.chainName || "base",
          token_ticker: args.tokenTicker || "carv",
        },
        null,
        2
      )}`;
    }
    return `Error retrieving address by Discord ID: ${result.error}`;
  }

  /**
   * Get user wallet address by Twitter ID.
   *
   * @param args - The arguments containing Twitter user ID and optional chain/token
   * @returns A JSON string containing the user's wallet address or error message
   */
  @CreateAction({
    name: "get_address_by_twitter_id",
    description: `
This tool retrieves a user's wallet address using their Twitter ID or username.

A successful response will return:
    {
      "user_address": "0xacf85e57cfff872a076ec1e5350fd959d08763db",
      "balance": "0.000000",
      "chain_name": "ethereum",
      "token_ticker": "carv"
    }

A failure response will return an error message:
    Error retrieving address: User not found`,
    schema: CarvGetAddressByTwitterIdSchema,
  })
  async getAddressByTwitterId(
    args: z.infer<typeof CarvGetAddressByTwitterIdSchema>
  ): Promise<string> {
    const result = await this.makeRequest("/user_balance_by_twitter_id", {
      twitter_user_id: args.twitterUserId,
      chain_name: args.chainName || "base",
      token_ticker: args.tokenTicker || "carv",
    });

    if (result.success && result.data) {
      return `Successfully retrieved user address by Twitter ID:\n${JSON.stringify(
        {
          user_address: result.data.data.user_address,
          balance: result.data.data.balance,
          chain_name: args.chainName || "base",
          token_ticker: args.tokenTicker || "carv",
        },
        null,
        2
      )}`;
    }
    return `Error retrieving address by Twitter ID: ${result.error}`;
  }

  /**
   * Get user token balance by Discord ID.
   *
   * @param args - The arguments containing Discord user ID and optional chain/token
   * @returns A JSON string containing the user's balance and address or error message
   */
  @CreateAction({
    name: "get_balance_by_discord_id",
    description: `
This tool retrieves a user's token balance using their Discord ID.

A successful response will return:
    {
      "user_address": "0xacf85e57cfff872a076ec1e5350fd959d08763db",
      "balance": "21.585240",
      "chain_name": "base",
      "token_ticker": "carv"
    }

A failure response will return an error message:
    Error retrieving balance: User not found`,
    schema: CarvGetBalanceByDiscordIdSchema,
  })
  async getBalanceByDiscordId(
    args: z.infer<typeof CarvGetBalanceByDiscordIdSchema>
  ): Promise<string> {
    return this.getAddressByDiscordId(args);
  }

  /**
   * Get user token balance by Twitter ID.
   *
   * @param args - The arguments containing Twitter user ID and optional chain/token
   * @returns A JSON string containing the user's balance and address or error message
   */
  @CreateAction({
    name: "get_balance_by_twitter_id",
    description: `
This tool retrieves a user's token balance using their Twitter ID or username.

A successful response will return:
    {
      "user_address": "0xacf85e57cfff872a076ec1e5350fd959d08763db",
      "balance": "0.000000",
      "chain_name": "ethereum",
      "token_ticker": "carv"
    }

A failure response will return an error message:
    Error retrieving balance: User not found`,
    schema: CarvGetBalanceByTwitterIdSchema,
  })
  async getBalanceByTwitterId(
    args: z.infer<typeof CarvGetBalanceByTwitterIdSchema>
  ): Promise<string> {
    return this.getAddressByTwitterId(args);
  }

  /**
   * Checks if the CARV action provider supports the given network.
   * CARV actions don't depend on blockchain networks directly, so always return true.
   *
   * @param _ - The network to check (not used)
   * @returns Always returns true as CARV actions are network-independent
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }
}

/**
 * Factory function to create a new CarvActionProvider instance.
 *
 * @param config - The configuration options for the CarvActionProvider
 * @returns A new instance of CarvActionProvider
 */
export const carvActionProvider = (config: CarvActionProviderConfig = {}) =>
  new CarvActionProvider(config);