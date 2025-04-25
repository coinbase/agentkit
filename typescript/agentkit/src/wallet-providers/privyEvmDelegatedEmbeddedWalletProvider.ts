import { WalletWithMetadata } from "@privy-io/server-auth";
import canonicalize from "canonicalize";
import crypto from "crypto";
import {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  Hex,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  TransactionReceipt,
  TransactionRequest,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { Network } from "../network";
import { NETWORK_ID_TO_CHAIN_ID, getChain } from "../network/network";
import { PrivyWalletConfig, PrivyWalletExport, createPrivyClient } from "./privyShared";
import { WalletProvider } from "./walletProvider";

interface PrivyResponse<T> {
  data: T;
}

/**
 * Configuration options for the Privy Embedded Wallet provider.
 */
export interface PrivyEvmDelegatedEmbeddedWalletConfig extends PrivyWalletConfig {
  /** The ID of the delegated wallet */
  walletId: string;

  /** The network ID to connect to (e.g., "base-mainnet") */
  networkId?: string;

  /** The chain ID to connect to */
  chainId?: string;

  /** The wallet type to use */
  walletType: "embedded";
}

/**
 * A wallet provider that uses Privy's embedded wallets with delegation.
 * This provider extends the EvmWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivyEvmDelegatedEmbeddedWalletProvider extends WalletProvider {
  #walletId: string;
  #address: string;
  #appId: string;
  #appSecret: string;
  #authKey: string;
  #network: Network;
  #publicClient: PublicClient;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param config - The configuration options for the wallet provider
   */
  private constructor(config: PrivyEvmDelegatedEmbeddedWalletConfig & { address: string }) {
    super();

    this.#walletId = config.walletId;
    this.#address = config.address;
    this.#appId = config.appId;
    this.#appSecret = config.appSecret;
    this.#authKey = config.authorizationPrivateKey || "";

    const networkId = config.networkId || "base-sepolia";
    const chainId = config.chainId || NETWORK_ID_TO_CHAIN_ID[networkId];

    this.#network = {
      protocolFamily: "evm",
      networkId: networkId,
      chainId: chainId,
    };

    // Create a public client for read operations
    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    this.#publicClient = createPublicClient({
      chain,
      transport: http(),
    });
  }

  /**
   * Creates and configures a new PrivyEvmDelegatedEmbeddedWalletProvider instance.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured PrivyEvmDelegatedEmbeddedWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   authorizationPrivateKey: "your-auth-key",
   *   walletId: "privy-wallet-id",
   *   networkId: "base-mainnet"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: PrivyEvmDelegatedEmbeddedWalletConfig,
  ): Promise<PrivyEvmDelegatedEmbeddedWalletProvider> {
    try {
      if (!config.walletId) {
        throw new Error("walletId is required for PrivyEvmDelegatedEmbeddedWalletProvider");
      }

      if (!config.appId || !config.appSecret) {
        throw new Error(
          "appId and appSecret are required for PrivyEvmDelegatedEmbeddedWalletProvider",
        );
      }

      if (!config.authorizationPrivateKey) {
        throw new Error(
          "authorizationPrivateKey is required for PrivyEvmDelegatedEmbeddedWalletProvider",
        );
      }

      const privyClient = createPrivyClient(config);
      const user = await privyClient.getUser(config.walletId);

      const embeddedWallets = user.linkedAccounts.filter(
        (account): account is WalletWithMetadata =>
          account.type === "wallet" && account.walletClientType === "privy",
      );

      if (embeddedWallets.length === 0) {
        throw new Error(`Could not find wallet address for wallet ID ${config.walletId}`);
      }

      const walletAddress = embeddedWallets[0].address;

      // Verify the network/chain ID if provided
      if (config.chainId) {
        const chain = getChain(config.chainId);
        if (!chain) {
          throw new Error(`Chain with ID ${config.chainId} not found`);
        }
      }

      return new PrivyEvmDelegatedEmbeddedWalletProvider({
        ...config,
        address: walletAddress as string,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to configure Privy embedded wallet provider: ${error.message}`);
      }
      throw new Error("Failed to configure Privy embedded wallet provider");
    }
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    return this.#address;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return this.#network;
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
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
    try {
      const balance = await this.#publicClient.getBalance({
        address: this.#address as Address,
      });

      return balance;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error getting balance: ${error.message}`);
      }
      throw new Error("Error getting balance");
    }
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string): Promise<Hex> {
    const body = {
      address: this.#address,
      chain_type: "ethereum",
      method: "personal_sign",
      params: {
        message,
        encoding: "utf-8",
      },
    };

    try {
      const response = await this.executePrivyRequest<PrivyResponse<{ signature: Hex }>>(body);
      return response.data?.signature;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Message signing failed: ${error.message}`);
      }
      throw new Error("Message signing failed");
    }
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param typedData - The typed data object to sign
   * @param typedData.domain - The domain object containing contract and chain information
   * @param typedData.types - The type definitions for the structured data
   * @param typedData.primaryType - The primary type being signed
   * @param typedData.message - The actual data to sign
   * @returns A Address that resolves to the signed typed data as a hex string
   */
  async signTypedData(typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex> {
    const body = {
      address: this.#address,
      chain_type: "ethereum",
      chain_id: this.#network.chainId,
      ...typedData,
    };

    try {
      const response = await this.executePrivyRequest<{ signature: Hex }>({
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
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<Hex> {
    const body = {
      address: this.#address,
      chain_type: "ethereum",
      method: "eth_signTransaction",
      params: {
        transaction: {
          ...transaction,
          from: this.#address,
        },
      },
    };

    try {
      const response =
        await this.executePrivyRequest<PrivyResponse<{ signed_transaction: Hex }>>(body);
      return response.data?.signed_transaction;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transaction signing failed: ${error.message}`);
      }
      throw new Error("Transaction signing failed");
    }
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    const body = {
      address: this.#address,
      chain_type: "ethereum",
      method: "eth_sendTransaction",
      caip2: `eip155:${this.#network.chainId!}`,
      params: {
        transaction: {
          ...transaction,
          from: this.#address,
        },
      },
    };

    try {
      const response = await this.executePrivyRequest<PrivyResponse<{ hash: Hex }>>(body);
      return response.data?.hash;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transaction sending failed: ${error.message}`);
      }
      throw new Error("Transaction sending failed");
    }
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  async waitForTransactionReceipt(txHash: Hex): Promise<TransactionReceipt> {
    return await this.#publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
  }

  /**
   * Reads data from a smart contract.
   *
   * @param params - Parameters for reading the contract
   * @param params.address - The address of the contract
   * @param params.abi - The ABI of the contract
   * @param params.functionName - The name of the function to call
   * @param params.args - The arguments to pass to the function
   * @returns A Address that resolves to the contract function's return value
   */
  async readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>> {
    return this.#publicClient.readContract<abi, functionName, args>(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in Wei.
   * @returns The transaction hash.
   */
  async nativeTransfer(to: string, value: string): Promise<Hex> {
    const valueInWei = parseEther(value);
    const valueHex = `0x${valueInWei.toString(16)}`;

    const body = {
      address: this.#address,
      chain_type: "ethereum",
      method: "eth_sendTransaction",
      caip2: `eip155:${this.#network.chainId!}`,
      params: {
        transaction: {
          to,
          value: valueHex,
        },
      },
    };

    try {
      const response = await this.executePrivyRequest<PrivyResponse<{ hash: Hex }>>(body);

      const receipt = await this.waitForTransactionReceipt(response.data.hash);

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return receipt.transactionHash;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Native transfer failed: ${error.message}`);
      }
      throw new Error("Native transfer failed");
    }
  }

  /**
   * Exports the wallet information.
   *
   * @returns The wallet data
   */
  exportWallet(): PrivyWalletExport {
    return {
      walletId: this.#walletId,
      authorizationPrivateKey: this.#authKey,
      networkId: this.#network.networkId!,
      chainId: this.#network.chainId,
    };
  }

  /**
   * Generate Privy authorization signature for API requests
   *
   * @param url - The URL for the request
   * @param body - The request body
   * @returns The generated signature
   */
  private generatePrivySignature(url: string, body: object): string {
    try {
      const payload = {
        version: 1,
        method: "POST",
        url,
        body,
        headers: {
          "privy-app-id": this.#appId,
        },
      };

      const serializedPayload = canonicalize(payload);
      if (!serializedPayload) throw new Error("Failed to canonicalize payload");

      const serializedPayloadBuffer = Buffer.from(serializedPayload);

      const privateKeyAsString = this.#authKey.replace("wallet-auth:", "");
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
   * Get Privy headers for API requests
   *
   * @param url - The URL for the request
   * @param body - The request body
   * @returns The headers for the request
   */
  private getPrivyHeaders(url: string, body: object) {
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${this.#appId}:${this.#appSecret}`).toString("base64")}`,
      "privy-app-id": this.#appId,
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
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Privy request failed: " + error.message);
      }
      throw new Error("Privy request failed with unknown error");
    }
  }
}
