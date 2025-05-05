import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { OKXDexQuoteSchema, OKXDexSwapSchema, OKXDexBroadcastSchema } from "./schemas";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers";
import * as crypto from "crypto";
import { VersionedTransaction, Transaction, PublicKey, Connection, ComputeBudgetProgram, TransactionMessage, VersionedMessage } from "@solana/web3.js";
import bs58 from "bs58";

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

  /**
   * Solana RPC URL
   */
  solanaRpcUrl?: string;
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
  private readonly baseUrl: string = "https://www.okx.com";
  private readonly solanaRpcUrl: string;
  protected walletProvider?: SvmWalletProvider;

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
    this.solanaRpcUrl = config.solanaRpcUrl || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

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
   * @param body - Request body (if applicable)
   * @returns Headers for OKX API request
   */
  private generateHeaders(
    method: string,
    requestPath: string,
    queryParams: string = "",
    body: string = ""
  ): Record<string, string> {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp, method, requestPath, queryParams, body);

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
      params.append("chainId", args.chainId || "501");
      params.append("amount", args.amount);
      params.append("fromTokenAddress", args.fromTokenAddress);
      params.append("toTokenAddress", args.toTokenAddress);

      // Add optional parameters if provided
      if (args.slippage) {
        params.append("slippage", args.slippage);
      }

      if (args.dexIds) {
        params.append("dexIds", args.dexIds);
      }

      if (args.directRoute != null) {
        params.append("directRoute", args.directRoute.toString());
      }

      if (args.priceImpactProtectionPercentage) {
        params.append("priceImpactProtectionPercentage", args.priceImpactProtectionPercentage);
      }

      if (args.autoSlippage != null) {
        params.append("autoSlippage", args.autoSlippage.toString());
      }

      if (args.maxAutoSlippage) {
        params.append("maxAutoSlippage", args.maxAutoSlippage);
      }

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

  private async checkTransactionStatus(connection: Connection, signature: string): Promise<{ success: boolean; message: string }> {
    try {
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return { success: false, message: "Transaction not found on-chain" };
      }

      if (tx.meta?.err) {
        return { success: false, message: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
      }

      return { 
        success: true, 
        message: `✅ Transaction confirmed!\n🔍 View on OKX Explorer: https://web3.okx.com/explorer/solana/tx/${signature}` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error checking transaction status: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Swaps tokens on OKX DEX
   *
   * @param args - The arguments containing the swap details
   * @returns A JSON string with the swap result or an error message
   */
  @CreateAction({
    name: "swap_tokens",
    description: `
This tool will swap tokens on OKX DEX.

A successful response will return a JSON payload with the swap result including:
- Transaction hash
- Status
- Error details (if applicable)

A failure response will return an error message with details.
`,
    schema: OKXDexSwapSchema,
  })
  async swapTokens(
    args: z.infer<typeof OKXDexSwapSchema>
  ): Promise<string> {
    try {
      // Build the swap request path
      const swapRequestPath = "/api/v5/dex/aggregator/swap";

      const params = new URLSearchParams();
      params.append("chainId", args.chainId || "501");
      params.append("amount", args.amount);
      params.append("fromTokenAddress", args.fromTokenAddress);
      params.append("toTokenAddress", args.toTokenAddress);
      params.append("slippage", args.slippage);
      params.append("userWalletAddress", args.userWalletAddress);

      // Add all optional parameters if provided
      if (args.swapReceiverAddress) {
        params.append("swapReceiverAddress", args.swapReceiverAddress);
      }

      if (args.feePercent) {
        params.append("feePercent", args.feePercent);
      }

      if (args.fromTokenReferrerWalletAddress) {
        params.append("fromTokenReferrerWalletAddress", args.fromTokenReferrerWalletAddress);
      }

      if (args.toTokenReferrerWalletAddress) {
        params.append("toTokenReferrerWalletAddress", args.toTokenReferrerWalletAddress);
      }

      if (args.enablePositiveSlippage != null) {
        params.append("enablePositiveSlippage", args.enablePositiveSlippage.toString());
      }

      if (args.gaslimit) {
        params.append("gaslimit", args.gaslimit);
      }

      if (args.gasLevel) {
        params.append("gasLevel", args.gasLevel);
      }

      if (args.dexIds) {
        params.append("dexIds", args.dexIds);
      }

      if (args.directRoute != null) {
        params.append("directRoute", args.directRoute.toString());
      }

      if (args.priceImpactProtectionPercentage) {
        params.append("priceImpactProtectionPercentage", args.priceImpactProtectionPercentage);
      }

      if (args.callDataMemo) {
        params.append("callDataMemo", args.callDataMemo);
      }

      if (args.computeUnitPrice) {
        params.append("computeUnitPrice", args.computeUnitPrice);
      }

      if (args.computeUnitLimit) {
        params.append("computeUnitLimit", args.computeUnitLimit);
      }

      if (args.autoSlippage != null) {
        params.append("autoSlippage", args.autoSlippage.toString());
      }

      if (args.maxAutoSlippage) {
        params.append("maxAutoSlippage", args.maxAutoSlippage);
      }

      const queryString = params.toString();
      const swapHeaders = this.generateHeaders("GET", swapRequestPath, queryString);

      const swapResponse = await fetch(
        `${this.baseUrl}${swapRequestPath}?${queryString}`,
        {
          method: "GET",
          headers: swapHeaders
        }
      );

      if (!swapResponse.ok) {
        const errorData = await swapResponse.json();
        return `Error getting swap transaction data: ${JSON.stringify(errorData, null, 2)}`;
      }

      const swapData = await swapResponse.json();

      // Process the response from the swap endpoint
      if (swapData.code !== "0") {
        return `OKX DEX swap failed with error: ${swapData.msg || "Unknown error"}`;
      }

      // Extract transaction data from response
      const txData = swapData.data[0].tx;

      // Check if we have a wallet provider to sign the transaction
      if (!this.walletProvider) {
        return `Successfully created swap transaction, but no wallet provider is available to sign and broadcast it. Transaction data: ${JSON.stringify(txData, null, 2)}`;
      }

      // For Solana transactions (chainId "501")
      if (args.chainId === "501") {
        try {
          // Create Solana connection
          const connection = new Connection(this.solanaRpcUrl);

          // Get fresh blockhash
          const recentBlockHash = await connection.getLatestBlockhash();
          console.log("Got blockhash:", recentBlockHash.blockhash);

          // Decode transaction data
          const decodedTransaction = bs58.decode(txData.data);
          let transaction;

          try {
            // Try versioned transaction first
            transaction = VersionedTransaction.deserialize(decodedTransaction);
            
            // Update the blockhash directly on the message
            transaction.message.recentBlockhash = recentBlockHash.blockhash;
          } catch (e) {
            // Fall back to legacy transaction
            console.log("Versioned transaction failed, trying legacy:", e);
            transaction = Transaction.from(decodedTransaction);
            console.log("Successfully created legacy transaction");
            transaction.recentBlockhash = recentBlockHash.blockhash;
          }

          // Add compute budget instruction
          const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1000000 // Match the working example's compute units
          });

          // Only add compute budget for legacy transactions
          if (!(transaction instanceof VersionedTransaction)) {
            transaction.instructions.unshift(computeBudgetIx);
          }

          console.log("Signing and sending transaction");
          const txSignature = await this.walletProvider.signAndSendTransaction(transaction);
          console.log("Transaction sent, checking status...");

          try {
            // First quick check with 'processed' commitment
            const quickCheck = await Promise.race([
              connection.confirmTransaction({
                signature: txSignature,
                blockhash: recentBlockHash.blockhash,
                lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
              }, 'processed'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Quick check timeout')), 2000)
              )
            ]) as { value: { err: any } };

            if (quickCheck.value.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(quickCheck.value.err)}`);
            }

            // If quick check passed, verify transaction exists
            const tx = await connection.getTransaction(txSignature, {
              maxSupportedTransactionVersion: 0
            });

            if (!tx) {
              throw new Error("Transaction not found on-chain");
            }

            if (tx.meta?.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(tx.meta.err)}`);
            }

            return `✅ Swap executed successfully!\n🔍 Track transaction: https://web3.okx.com/explorer/solana/tx/${txSignature}`;
          } catch (error) {
            // If quick check failed, try one more time with a bit more patience
            console.log("Quick check failed, trying one more time...");
            try {
              const finalCheck = await Promise.race([
                connection.confirmTransaction({
                  signature: txSignature,
                  blockhash: recentBlockHash.blockhash,
                  lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
                }, 'confirmed'),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Final check timeout')), 3000)
                )
              ]) as { value: { err: any } };

              if (finalCheck.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(finalCheck.value.err)}`);
              }

              return `✅ Swap executed successfully!\n🔍 Track transaction: https://web3.okx.com/explorer/solana/tx/${txSignature}`;
            } catch (finalError) {
              // If all checks fail, verify transaction exists
              const tx = await connection.getTransaction(txSignature, {
                maxSupportedTransactionVersion: 0
              });

              if (tx && !tx.meta?.err) {
                return `✅ Swap executed successfully!\n🔍 Track transaction: https://web3.okx.com/explorer/solana/tx/${txSignature}`;
              }

              throw new Error(`Transaction failed: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
            }
          }
        } catch (error: unknown) {
          console.error("Error in Solana transaction processing:", error);
          return `Error processing transaction: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      // For EVM-based transactions (Ethereum, BSC, etc.)
      else {
        try {
          // EVM transactions require different handling
          // This would depend on your wallet provider implementation for EVM chains
          // Here's a placeholder for the EVM implementation
          return `Swap transaction created for EVM chain, but EVM transaction signing is not implemented in this provider. Transaction data: ${JSON.stringify(txData, null, 2)}`;
        } catch (txError: unknown) {
          return `Error processing EVM transaction: ${txError instanceof Error ? txError.message : String(txError)}`;
        }
      }
    } catch (error: unknown) {
      return `Error during OKX DEX swap: ${error instanceof Error ? error.message : String(error)}`;
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
    const supportedChains = [
      "1",    // Ethereum
      "56",   // BNB Smart Chain
      "137",  // Polygon
      "42161", // Arbitrum One
      "10",   // Optimism
      "43114", // Avalanche C-Chain
      "8453",  // Base
      "1101",  // Polygon zkEVM
      "501"   // Solana
    ];

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