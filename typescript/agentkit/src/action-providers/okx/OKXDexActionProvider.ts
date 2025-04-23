import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { OKXDexClient } from "@okx-dex/okx-dex-sdk";
import { OKXDexQuoteSchema } from "./schemas";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";

/**
 * Configuration options for the OKXDexActionProvider.
 */
export interface OKXDexActionProviderConfig {
  /**
   * OKX API Key
   */
  apiKey?: string;
  
  /**
   * OKX Secret Key
   */
  secretKey?: string;
  
  /**
   * OKX API Passphrase
   */
  apiPassphrase?: string;
  
  /**
   * OKX Project ID
   */
  projectId?: string;
}

/**
 * OKXDexActionProvider is an action provider for interacting with the OKX DEX API.
 * This provider enables querying for token swap quotes and other DEX operations.
 */
export class OKXDexActionProvider extends ActionProvider<WalletProvider> {
  private readonly client: OKXDexClient;
  
  /**
   * Creates a new instance of OKXDexActionProvider
   *
   * @param config - Configuration options including the API credentials
   */
  constructor(config: OKXDexActionProviderConfig = {}) {
    super("okxDex", []);
    
    // Use provided config values or fallback to environment variables
    config.apiKey ||= process.env.OKX_API_KEY;
    config.secretKey ||= process.env.OKX_SECRET_KEY;
    config.apiPassphrase ||= process.env.OKX_API_PASSPHRASE;
    config.projectId ||= process.env.OKX_PROJECT_ID;
    
    // Validate required configuration
    if (!config.apiKey || !config.secretKey || !config.apiPassphrase || !config.projectId) {
      throw new Error("OKX_API_KEY, OKX_SECRET_KEY, OKX_API_PASSPHRASE, and OKX_PROJECT_ID must be configured.");
    }
    
    // Initialize the OKX DEX client
    this.client = new OKXDexClient({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      apiPassphrase: config.apiPassphrase,
      projectId: config.projectId
    });
  }
  
  /**
   * Get a quote for swapping tokens on OKX DEX
   *
   * @param args - The arguments containing the swap details
   * @returns A JSON string with the swap quote or an error message
   */
  @CreateAction({
    name: "get_swap_quote",
    description: `
This tool will fetch a swap quote from OKX DEX for exchanging one token for another.

A successful response will return a JSON payload with quote details including:
- Exchange rate
- Expected output amount
- Gas estimates
- Price impact
- Route information

A failure response will return an error message with details.
    `,
    schema: OKXDexQuoteSchema,
  })
  async getSwapQuote(
    args: z.infer<typeof OKXDexQuoteSchema>
  ): Promise<string> {
    try {
      const quote = await this.client.dex.getQuote({
        chainId: args.chainId,
        fromTokenAddress: args.fromTokenAddress,
        toTokenAddress: args.toTokenAddress,
        amount: args.amount,
        slippage: args.slippage,
      });
      
      return `Successfully fetched OKX DEX swap quote:\n${JSON.stringify(quote, null, 2)}`;
    } catch (error) {
      return `Error fetching OKX DEX swap quote: ${error}`;
    }
  }
  
  /**
   * Checks if the OKX DEX action provider supports the given network.
   * 
   * @param network - The network to check support for
   * @returns Boolean indicating if the network is supported
   */
  supportsNetwork = (network: Network): boolean => {
    // List of supported chain IDs by OKX DEX
    const supportedChains = ["1", "56", "137", "42161", "10", "43114", "8453", "1101"];
    
    if (!network.chainId) {
      return true; // If no chainId provided, assume general support
    }
    
    return supportedChains.includes(network.chainId);
  };
}

/**
 * Factory function to create a new OKXDexActionProvider instance.
 *
 * @param config - The configuration options for the provider.
 * @returns A new instance of OKXDexActionProvider.
 */
export const okxDexActionProvider = (config?: OKXDexActionProviderConfig) =>
  new OKXDexActionProvider(config);