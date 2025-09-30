import { EvmWalletProvider } from "./evmWalletProvider";
import {
  createPublicClient,
  http,
  type PublicClient,
  type TransactionRequest,
  type Hex,
  type Abi,
  type ContractFunctionName,
  type ContractFunctionArgs,
  type ReadContractParameters,
  type ReadContractReturnType,
} from "viem";
import { getChain, NETWORK_ID_TO_CHAIN_ID } from "../network/network";
import { type Network } from "../network";
import {
  type DynamicWalletConfig,
  type DynamicWalletExport,
  type DynamicWalletClient,
  createDynamicWallet,
} from "./dynamicShared";

/**
 * Configuration options for the Dynamic wallet provider.
 *
 * @interface
 */
export interface DynamicEvmWalletConfig extends DynamicWalletConfig {
  /** Optional chain ID to connect to */
  chainId?: string;
  /** Optional RPC URL override for Viem public client */
  rpcUrl?: string;
}

/**
 * A wallet provider that uses Dynamic's wallet API.
 * This provider extends EvmWalletProvider and implements all signing operations
 * using Dynamic's embedded wallet infrastructure.
 */
export class DynamicEvmWalletProvider extends EvmWalletProvider {
  #accountAddress: string;
  #dynamicClient: DynamicWalletClient;
  #publicClient: PublicClient;
  #network: Network;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param accountAddress - The wallet account address
   * @param dynamicClient - The Dynamic wallet client instance
   * @param publicClient - The public client for read operations and broadcasting
   * @param network - The network configuration
   */
  private constructor(
    accountAddress: string,
    dynamicClient: DynamicWalletClient,
    publicClient: PublicClient,
    network: Network,
  ) {
    super();
    this.#accountAddress = accountAddress;
    this.#dynamicClient = dynamicClient;
    this.#publicClient = publicClient;
    this.#network = network;
  }

  /**
   * Creates and configures a new DynamicWalletProvider instance.
   *
   * @param config - The configuration options for the Dynamic wallet
   * @returns A configured DynamicWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await DynamicWalletProvider.configureWithWallet({
   *   authToken: "your-auth-token",
   *   environmentId: "your-environment-id",
   *   networkId: "base-sepolia",
   *   thresholdSignatureScheme: "TWO_OF_TWO"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: DynamicEvmWalletConfig,
  ): Promise<DynamicEvmWalletProvider> {
    const networkId = config.networkId || "base-sepolia";
    const chainId = NETWORK_ID_TO_CHAIN_ID[networkId];

    if (!chainId) {
      throw new Error(`Unsupported network ID: ${networkId}`);
    }

    console.log("[DynamicEvmWalletProvider] Starting wallet configuration with config:", {
      networkId,
      chainId,
      environmentId: config.environmentId,
    });

    const { wallet, dynamic } = await createDynamicWallet(config, "ethereum");

    const chain = getChain(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    const network: Network = {
      protocolFamily: "evm",
      chainId,
      networkId,
    };

    const rpcUrl = config.rpcUrl || process.env.RPC_URL;
    const publicClient = createPublicClient({
      chain,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    console.log("[DynamicEvmWalletProvider] Wallet configured successfully:", {
      address: wallet.accountAddress,
      network: networkId,
    });

    return new DynamicEvmWalletProvider(wallet.accountAddress, dynamic, publicClient, network);
  }

  /**
   * Signs a raw hash.
   *
   * @param _hash - The hash to sign
   * @returns The signed hash
   * @throws Error indicating this operation is not supported
   */
  async sign(_hash: `0x${string}`): Promise<`0x${string}`> {
    throw new Error(
      "Raw hash signing not implemented for Dynamic wallet provider. Use signMessage or signTransaction instead.",
    );
  }

  /**
   * Signs a message using Dynamic's signing service.
   *
   * @param message - The message to sign (string or Uint8Array)
   * @returns The signature as a hex string with 0x prefix
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);

    const signature = await this.#dynamicClient.signMessage({
      message: messageStr,
      accountAddress: this.#accountAddress,
    });
    return signature as `0x${string}`;
  }

  /**
   * Signs typed data.
   *
   * @param _typedData - The typed data to sign
   * @returns The signed typed data
   * @throws Error indicating this operation is not supported
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(_typedData: any): Promise<`0x${string}`> {
    throw new Error("Typed data signing not implemented for Dynamic wallet provider.");
  }

  /**
   * Signs a transaction using Dynamic's signing service.
   *
   * @param transaction - The transaction to sign
   * @returns The signed transaction as a hex string
   */
  async signTransaction(transaction: TransactionRequest): Promise<Hex> {
    if (!this.#publicClient.chain) {
      throw new Error("Chain not found");
    }

    console.log("[DynamicEvmWalletProvider] Preparing transaction for signing:", {
      to: transaction.to,
      value: transaction.value?.toString(),
      data: transaction.data,
    });

    // Prepare transaction with gas estimation using Viem
    // This follows Dynamic's recommended pattern from their docs
    const preparedTx = await this.#publicClient.prepareTransactionRequest({
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      account: this.#accountAddress as `0x${string}`,
      chain: this.#publicClient.chain,
    });

    console.log("[DynamicEvmWalletProvider] Transaction prepared, signing with Dynamic:", {
      to: preparedTx.to,
      value: preparedTx.value?.toString(),
      gas: preparedTx.gas?.toString(),
      nonce: preparedTx.nonce,
    });

    try {
      // Dynamic import for ESM compatibility
      const { DynamicEvmWalletClient: _DynamicEvmWalletClient } = (await import(
        "@dynamic-labs-wallet/node-evm"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      )) as any;

      // Retrieve external server key shares required for signing
      // This is required when wallet was created without backUpToClientShareService: true
      console.log("[DynamicEvmWalletProvider] Retrieving external server key shares...");
      const keyShares = await (
        this.#dynamicClient as InstanceType<typeof _DynamicEvmWalletClient>
      ).getExternalServerKeyShares({
        accountAddress: this.#accountAddress,
      });
      if (keyShares && keyShares.length)
        console.log("[DynamicEvmWalletProvider] Retrieved", keyShares.length, "key shares");

      // Sign using Dynamic's signTransaction with external key shares
      const signedTx = await (
        this.#dynamicClient as InstanceType<typeof _DynamicEvmWalletClient>
      ).signTransaction({
        senderAddress: this.#accountAddress as `0x${string}`,
        externalServerKeyShares: keyShares || [],
        transaction: preparedTx,
      });

      console.log("[DynamicEvmWalletProvider] Transaction signed successfully");
      return signedTx as Hex;
    } catch (error) {
      console.error("[DynamicEvmWalletProvider] Error signing transaction:", error);
      throw error;
    }
  }

  /**
   * Sends a transaction by signing it with Dynamic and broadcasting it.
   *
   * @param transaction - The transaction to send
   * @returns The transaction hash
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    console.log("[DynamicEvmWalletProvider] Sending transaction:", {
      to: transaction.to,
      value: transaction.value?.toString(),
      data: transaction.data,
    });

    // Sign the transaction using Dynamic
    const signedTx = await this.signTransaction(transaction);

    // Broadcast the signed transaction
    console.log("[DynamicEvmWalletProvider] Broadcasting signed transaction...");
    const txHash = await this.#publicClient.sendRawTransaction({
      serializedTransaction: signedTx,
    });

    console.log("[DynamicEvmWalletProvider] Transaction sent successfully:", txHash);
    return txHash;
  }

  /**
   * Exports the private key for the wallet.
   *
   * @param password - Optional password for encrypted backup shares
   * @returns The private key
   */
  public async exportPrivateKey(password?: string): Promise<string> {
    const result = await this.#dynamicClient.exportPrivateKey({
      accountAddress: this.getAddress(),
      password,
    });
    return result.derivedPrivateKey || "";
  }

  /**
   * Imports a private key.
   *
   * @param privateKey - The private key to import
   * @param password - Optional password for encrypted backup shares
   * @returns The account address and public key
   */
  public async importPrivateKey(
    privateKey: string,
    password?: string,
  ): Promise<{
    accountAddress: string;
    publicKeyHex: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ThresholdSignatureScheme } = (await import("@dynamic-labs-wallet/node")) as any;
    const result = await this.#dynamicClient.importPrivateKey({
      privateKey,
      chainName: "EVM",
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      password,
    });
    return {
      accountAddress: result.accountAddress,
      publicKeyHex: "publicKeyHex" in result ? result.publicKeyHex : "",
    };
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for
   * @returns The transaction receipt
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return await this.#publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract
   * @returns The response from the contract
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
   * Gets the Viem PublicClient used for read-only operations.
   *
   * @returns The Viem PublicClient instance
   */
  getPublicClient(): PublicClient {
    return this.#publicClient;
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet in wei
   */
  async getBalance(): Promise<bigint> {
    return await this.#publicClient.getBalance({
      address: this.#accountAddress as `0x${string}`,
    });
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address
   * @param value - The amount to transfer in atomic units (Wei)
   * @returns The transaction hash
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    const tx = await this.sendTransaction({
      to: to as `0x${string}`,
      value: BigInt(value),
    });

    const receipt = await this.waitForTransactionReceipt(tx);

    if (!receipt) {
      throw new Error("Transaction failed");
    }

    return receipt.transactionHash;
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The wallet address
   */
  getAddress(): string {
    return this.#accountAddress;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet
   */
  getNetwork(): Network {
    return this.#network;
  }

  /**
   * Gets the name of the provider.
   *
   * @returns The provider name
   */
  getName(): string {
    return "dynamic_evm_wallet_provider";
  }

  /**
   * Exports the wallet information.
   *
   * @returns The wallet information
   */
  async exportWallet(): Promise<DynamicWalletExport> {
    return {
      accountAddress: this.#accountAddress,
      networkId: this.#network.networkId,
    };
  }
}
