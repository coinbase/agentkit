// src/wallet-providers/privyEmbeddedWalletProvider.ts
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";

import axios from "axios";
import canonicalize from "canonicalize";
import crypto from "crypto";
import {
  Abi,
  ContractFunctionArgs,
  ContractFunctionName,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
} from "viem";

/**
 * Configuration options for the Privy Embedded Wallet provider.
 */
export interface PrivyEvmEmbeddedWalletConfig {
  /** The Privy App ID */
  appId: string;

  /** The Privy App Secret */
  appSecret: string;

  /** The Privy Authorization Private Key for wallet API access */
  authorizationPrivateKey: string;

  /** The ID of the delegated wallet */
  walletId: string;

  /** The network ID to connect to (e.g., "base-mainnet") */
  networkId?: string;

  /** The chain ID to connect to */
  chainId?: string;

  /** Gas configuration */
  gas?: {
    /** An internal multiplier on gas limit estimation. */
    gasLimitMultiplier?: number;

    /** An internal multiplier on fee per gas estimation. */
    feePerGasMultiplier?: number;
  };
}

/**
 * A wallet provider that uses Privy's embedded wallets with delegation.
 * This provider extends the EvmWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivyEvmEmbeddedWalletProvider extends EvmWalletProvider {
  private walletId: string;
  private address: string;
  private appId: string;
  private appSecret: string;
  private authKey: string;
  private network: Network;
  private gasLimitMultiplier: number;
  private feePerGasMultiplier: number;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param config - The configuration options for the wallet provider
   * @param address - The wallet address
   */
  private constructor(config: PrivyEvmEmbeddedWalletConfig, address: string) {
    super();

    this.walletId = config.walletId;
    this.address = address;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.authKey = config.authorizationPrivateKey;
    this.network = {
      protocolFamily: "evm",
      networkId: config.networkId || "base-sepolia",
      chainId: config.chainId || this.mapNetworkToChainId(config.networkId || "base-sepolia"),
    };
    this.gasLimitMultiplier = Math.max(config.gas?.gasLimitMultiplier ?? 1.2, 1);
    this.feePerGasMultiplier = Math.max(config.gas?.feePerGasMultiplier ?? 1, 1);
  }

  /**
   * Creates and configures a new PrivyEmbeddedWalletProvider instance.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured PrivyEmbeddedWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await PrivyEmbeddedWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   authorizationPrivateKey: "your-auth-key",
   *   walletId: "privy-wallet-id",
   *   networkId: "base-mainnet"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: PrivyEvmEmbeddedWalletConfig,
  ): Promise<PrivyEvmEmbeddedWalletProvider> {
    try {
      // Fetch wallet details to get the address
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64")}`,
        "privy-app-id": config.appId,
      };

      const url = `https://api.privy.io/v1/wallets/${config.walletId}`;
      const response = await axios.get(url, { headers });
      const walletAddress = response.data?.address || "";

      if (!walletAddress) {
        throw new Error(`Could not find wallet address for wallet ID ${config.walletId}`);
      }

      return new PrivyEvmEmbeddedWalletProvider(config, walletAddress);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Failed to configure Privy embedded wallet provider: " + error.message);
      }
      throw new Error("Failed to configure Privy embedded wallet provider with unknown error");
    }
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign
   * @returns A promise that resolves to the signed message as a hex string
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
      message: typeof message === "string" ? message : Buffer.from(message).toString("hex"),
    };

    const response = await this.executePrivyRequest<{ signature: `0x${string}` }>({
      method: "sign_message",
      params: body,
    });
    return response.signature;
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param typedData - The typed data object to sign
   * @param typedData.domain - The domain object containing contract and chain information
   * @param typedData.types - The type definitions for the structured data
   * @param typedData.primaryType - The primary type being signed
   * @param typedData.message - The actual data to sign
   * @returns A promise that resolves to the signed typed data as a hex string
   */
  async signTypedData(typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
      ...typedData,
    };

    try {
      const response = await this.executePrivyRequest<{ signature: `0x${string}` }>({
        method: "eth_signTypedData_v4",
        params: body,
      });
      return response.signature;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Typed data signing failed: " + error.message);
      }
      throw new Error("Typed data signing failed with unknown error");
    }
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign
   * @returns A promise that resolves to the signed transaction as a hex string
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
      transaction: {
        ...transaction,
        type: transaction.type ?? "0x2",
      },
    };

    const response = await this.executePrivyRequest<{ signature: `0x${string}` }>({
      method: "sign_transaction",
      params: body,
    });
    return response.signature;
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send
   * @returns A promise that resolves to the transaction hash
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
      transaction: {
        ...transaction,
        type: transaction.type ?? "0x2",
      },
    };

    const response = await this.executePrivyRequest<{ hash: `0x${string}` }>({
      method: "send_transaction",
      params: body,
    });
    return response.hash;
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for
   * @returns A promise that resolves to the transaction receipt
   */
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<{
    blockHash: `0x${string}`;
    blockNumber: bigint;
    contractAddress: string | null;
    cumulativeGasUsed: bigint;
    effectiveGasPrice: bigint;
    from: `0x${string}`;
    gasUsed: bigint;
    logs: Array<{
      address: `0x${string}`;
      topics: Array<`0x${string}`>;
      data: `0x${string}`;
      blockNumber: bigint;
      transactionHash: `0x${string}`;
      transactionIndex: number;
      blockHash: `0x${string}`;
      logIndex: number;
      removed: boolean;
    }>;
    logsBloom: `0x${string}`;
    status: 0 | 1;
    to: `0x${string}` | null;
    transactionHash: `0x${string}`;
    transactionIndex: number;
    type: number;
  }> {
    void txHash; // Mark parameter as intentionally unused
    /**This is not used implemented and used currently.
    added here for the sake of an error that has to do with inheriting the evmWalletProvider */
    throw new Error("Method not implemented");
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet
   */
  getAddress(): string {
    return this.address;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet
   */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider
   */
  getName(): string {
    return "privy_evm_embedded_wallet_provider";
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      method: "eth_getBalance",
      params: [this.address, "latest"],
    };

    try {
      const response = await this.executePrivyRequest<{ result: `0x${string}` }>({
        method: "eth_getBalance",
        params: body,
      });
      // Response contains hex string balance
      const balanceHex = response.result || "0x0";
      return BigInt(balanceHex);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Error getting balance: " + error.message);
      }
      throw new Error("Error getting balance with unknown error");
    }
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address
   * @param value - The amount to transfer in Wei
   * @returns The transaction hash
   */
  async nativeTransfer(to: string, value: string): Promise<`0x${string}`> {
    // Convert value to wei/hex format if needed
    const valueWei = BigInt(value);
    const valueHex = `0x${valueWei.toString(16)}`;

    const body = {
      address: this.address,
      chain_type: "ethereum",
      method: "eth_sendTransaction",
      params: {
        transaction: {
          to,
          value: valueHex,
          from: this.address,
        },
      },
    };

    try {
      const response = await this.executePrivyRequest<{ hash: `0x${string}` }>({
        method: "eth_sendTransaction",
        params: body,
      });
      return response.hash;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Native transfer failed: " + error.message);
      }
      throw new Error("Native transfer failed with unknown error");
    }
  }

  /**
   * Exports the wallet information.
   *
   * @returns The wallet data
   */
  async exportWallet(): Promise<{
    walletId: string;
    authorizationPrivateKey: string;
    networkId: string;
    chainId?: string;
  }> {
    return {
      walletId: this.walletId,
      authorizationPrivateKey: this.authKey,
      networkId: this.network.networkId!,
      chainId: this.network.chainId,
    };
  }

  /**
   * Gets the nonce for the current address.
   *
   * @returns A promise that resolves to the nonce as a hex string
   */
  async getNonce(): Promise<`0x${string}`> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
    };

    const response = await this.executePrivyRequest<{ nonce: `0x${string}` }>({
      method: "get_nonce",
      params: body,
    });
    return response.nonce;
  }

  /**
   * Reads data from a smart contract.
   *
   * @param params - Parameters for reading the contract
   * @param params.address - The address of the contract
   * @param params.abi - The ABI of the contract
   * @param params.functionName - The name of the function to call
   * @param params.args - The arguments to pass to the function
   * @returns A promise that resolves to the contract function's return value
   */
  async readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>> {
    const body = {
      address: this.address,
      chain_type: "ethereum",
      chain_id: this.mapNetworkToChainId(this.network.networkId!),
      contract: {
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
      },
    };

    const response = await this.executePrivyRequest<{
      result: ReadContractReturnType<abi, functionName, args>;
    }>({
      method: "eth_call",
      params: body,
    });
    return response.result;
  }

  /**
   * Maps a network ID to its corresponding chain ID.
   *
   * @param networkId - The network identifier to map (e.g., 'base-mainnet', 'ethereum-mainnet')
   * @returns The corresponding chain ID as a string
   */
  private mapNetworkToChainId(networkId: string): string {
    const networkToChainId: Record<string, string> = {
      "base-mainnet": "8453",
      "base-sepolia": "84532",
      "ethereum-mainnet": "1",
      "ethereum-sepolia": "11155111",
    };

    return networkToChainId[networkId] || "1";
  }

  /**
   * Generates a Privy authorization signature for API requests.
   *
   * @param url - The API endpoint URL to generate the signature for
   * @param body - The request body to include in the signature
   * @returns The generated signature as a base64 string
   */
  private generatePrivySignature(url: string, body: object): string {
    try {
      const payload = {
        version: 1,
        method: "POST",
        url,
        body,
        headers: {
          "privy-app-id": this.appId,
        },
      };

      const serializedPayload = canonicalize(payload);
      if (!serializedPayload) throw new Error("Failed to canonicalize payload");

      const serializedPayloadBuffer = Buffer.from(serializedPayload);

      const privateKeyAsString = this.authKey.replace("wallet-auth:", "");
      const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;

      const privateKey = crypto.createPrivateKey({
        key: privateKeyAsPem,
        format: "pem",
      });

      const signatureBuffer = crypto.sign("sha256", serializedPayloadBuffer, privateKey);
      return signatureBuffer.toString("base64");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error generating Privy authorization signature: ${error.message}`);
      }
      throw new Error("Error generating Privy authorization signature");
    }
  }

  /**
   * Gets the required headers for Privy API requests.
   *
   * @param url - The API endpoint URL to generate headers for
   * @param body - The request body to include in the signature
   * @returns An object containing the required headers
   */
  private getPrivyHeaders(url: string, body: object) {
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString("base64")}`,
      "privy-app-id": this.appId,
      "privy-authorization-signature": this.generatePrivySignature(url, body),
    };
  }

  /**
   * Execute a Privy API request.
   *
   * @param body - The request body to send to the Privy API
   * @returns A promise that resolves to the response data
   * @throws Error if the request fails
   */
  private async executePrivyRequest<T>(body: Record<string, unknown>): Promise<T> {
    const url = `https://api.privy.io/v1/wallets/rpc`;
    const headers = this.getPrivyHeaders(url, body);

    try {
      const response = await axios.post<T>(url, body, { headers });
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Privy request failed: " + error.message);
      }
      throw new Error("Privy request failed with unknown error");
    }
  }
}
