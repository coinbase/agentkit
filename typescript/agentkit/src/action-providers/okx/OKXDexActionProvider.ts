import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { OKXDexQuoteSchema } from "./schemas";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers";
import * as crypto from "crypto";

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
export class OKXDexActionProvider extends ActionProvider<SvmWalletProvider> {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly apiPassphrase: string;
  private readonly projectId: string;
  private readonly baseUrl: string = "https://beta.okex.org";
  
  /**
   * Creates a new instance of OKXDexActionProvider
   *
   * @param config - Configuration options including the API credentials
   */
  constructor(config: OKXDexActionProviderConfig = {}) {
    super("okxDex", []);
    
    // Use provided config values or fallback to environment variables
    this.apiKey = config.apiKey || process.env.OKX_API_KEY || "";
    this.secretKey = config.secretKey || process.env.OKX_SECRET_KEY || "";
    this.apiPassphrase = config.apiPassphrase || process.env.OKX_API_PASSPHRASE || "";
    this.projectId = config.projectId || process.env.OKX_PROJECT_ID || "";
    
    // Validate required configuration
    if (!this.apiKey || !this.secretKey || !this.apiPassphrase || !this.projectId) {
      throw new Error("OKX_API_KEY, OKX_SECRET_KEY, OKX_API_PASSPHRASE, and OKX_PROJECT_ID must be configured.");
    }
  }
  
  /**
   * Generate the required OKX API signature
   * 
   * @param timestamp - ISO timestamp for the request
   * @param method - HTTP method
   * @param requestPath - API endpoint path
   * @param queryParams - URL query parameters
   * @param body - Request body (if applicable)
   * @returns The signature for the API request
   */
  private generateSignature(
    timestamp: string,
    method: string,
    requestPath: string,
    queryParams: string = "",
    body: string = ""
  ): string {
    // Combine the signature components as per OKX API docs
    const signaturePayload = `${timestamp}${method}${requestPath}${queryParams ? "?" + queryParams : ""}${body}`;
    
    // Create HMAC signature with SHA256
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(signaturePayload)
      .digest("base64");
      
    return signature;
  }
  
  /**
   * Create headers required for OKX API requests
   * 
   * @param method - HTTP method
   * @param requestPath - API endpoint path
   * @param queryParams - URL query parameters
   * @returns Headers for OKX API request
   */
  private generateHeaders(
    method: string,
    requestPath: string,
    queryParams: string = ""
  ): Record<string, string> {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp, method, requestPath, queryParams);
    
    return {
      "OK-ACCESS-KEY": this.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.apiPassphrase,
      "OK-ACCESS-PROJECT": this.projectId,
      "Content-Type": "application/json"
    };
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
      // Build query parameters
      const params = new URLSearchParams();
      params.append("chainId", "501"); // Always Solana
      params.append("amount", args.amount);
      params.append("fromTokenAddress", args.fromTokenAddress);
      params.append("toTokenAddress", args.toTokenAddress);
      
      // Convert params to string for request
      const queryString = params.toString();
      
      // API endpoint path
      const requestPath = "/api/v5/dex/aggregator/quote";
      
      // Generate headers for the request
      const headers = this.generateHeaders("GET", requestPath, queryString);
      
      // Make the API request using fetch
      const response = await fetch(
        `${this.baseUrl}${requestPath}?${queryString}`,
        { 
          method: "GET",
          headers: headers 
        }
      );
      
      // Parse the response
      if (!response.ok) {
        const errorData = await response.json();
        return `Error fetching OKX DEX swap quote: ${JSON.stringify(errorData, null, 2)}`;
      }
      
      const data = await response.json();
      
      // Return the response data
      return `Successfully fetched OKX DEX swap quote:\n${JSON.stringify(data, null, 2)}`;
    } catch (error: unknown) {
      return `Error fetching OKX DEX swap quote: ${error instanceof Error ? error.message : String(error)}`;
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
    const supportedChains = ["501"];
    
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