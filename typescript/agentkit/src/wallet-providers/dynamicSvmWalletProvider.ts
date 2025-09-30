import { SvmWalletProvider } from "./svmWalletProvider";
import {
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  VersionedTransaction,
  MessageV0,
} from "@solana/web3.js";
import { SOLANA_CLUSTER_ID_BY_NETWORK_ID, SOLANA_NETWORKS } from "../network/svm";
import {
  type DynamicWalletConfig,
  type DynamicWalletExport,
  type DynamicWalletClient,
  createDynamicWallet,
} from "./dynamicShared";
import type {
  SignatureStatus,
  SignatureStatusConfig,
  RpcResponseAndContext,
  SignatureResult,
  Cluster,
} from "@solana/web3.js";
import type { Network } from "../network";

/**
 * Configuration options for the Dynamic Svm wallet provider.
 */
export interface DynamicSvmWalletConfig extends DynamicWalletConfig {
  /** Optional custom connection to use for the wallet */
  connection?: Connection;
}

/**
 * A wallet provider that uses Dynamic's wallet API.
 * This provider extends the SvmWalletProvider to provide Dynamic-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class DynamicSvmWalletProvider extends SvmWalletProvider {
  #accountAddress: string;
  #dynamicClient: DynamicWalletClient;
  #connection: Connection;
  #genesisHash: string;
  #publicKey: PublicKey;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param config - The configuration options for the Dynamic wallet
   */
  private constructor(
    config: DynamicSvmWalletConfig & {
      accountAddress: string;
      dynamicClient: DynamicWalletClient;
      connection: Connection;
      genesisHash: string;
    },
  ) {
    super();
    console.log("[DynamicSvmWalletProvider] Initializing provider with:", {
      accountAddress: config.accountAddress,
      genesisHash: config.genesisHash,
      networkId: config.networkId,
    });

    this.#accountAddress = config.accountAddress;
    this.#dynamicClient = config.dynamicClient;
    this.#connection = config.connection;
    this.#genesisHash = config.genesisHash;
    this.#publicKey = new PublicKey(config.accountAddress);

    console.log("[DynamicSvmWalletProvider] Provider initialization complete");
  }

  /**
   * Creates and configures a new DynamicSvmWalletProvider instance.
   *
   * @param config - The configuration options for the Dynamic wallet
   * @returns A configured DynamicSvmWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await DynamicSvmWalletProvider.configureWithWallet({
   *   authToken: "your-auth-token",
   *   environmentId: "your-environment-id",
   *   chainType: "solana",
   *   networkId: "mainnet-beta",
   *   thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO
   * });
   * ```
   */
  public static async configureWithWallet(
    config: DynamicSvmWalletConfig,
  ): Promise<DynamicSvmWalletProvider> {
    // Derive cluster config from networkId using existing mappings
    const clusterId = SOLANA_CLUSTER_ID_BY_NETWORK_ID[
      config.networkId as keyof typeof SOLANA_CLUSTER_ID_BY_NETWORK_ID
    ] as Cluster;
    if (!clusterId) {
      throw new Error(
        `Unsupported Solana network ID: ${config.networkId}. Use DynamicEvmWalletProvider for EVM networks.`,
      );
    }

    console.log("[DynamicSvmWalletProvider] Starting wallet configuration with config:", {
      networkId: config.networkId,
      clusterId,
      environmentId: config.environmentId,
    });

    try {
      const { wallet, dynamic } = await createDynamicWallet(config, "solana");

      console.log("[DynamicSvmWalletProvider] Wallet created:", {
        accountAddress: wallet.accountAddress,
      });

      const connection = config.connection ?? new Connection(clusterApiUrl(clusterId));

      console.log(
        "[DynamicSvmWalletProvider] Connection established with endpoint:",
        connection.rpcEndpoint,
      );

      const genesisHash = await connection.getGenesisHash();
      console.log("[DynamicSvmWalletProvider] Genesis hash retrieved:", genesisHash);

      const provider = new DynamicSvmWalletProvider({
        ...config,
        accountAddress: wallet.accountAddress,
        dynamicClient: dynamic,
        connection,
        genesisHash,
      });

      console.log("[DynamicSvmWalletProvider] Provider initialized with:", {
        address: provider.getAddress(),
        network: provider.getNetwork(),
        name: provider.getName(),
      });

      return provider;
    } catch (error) {
      console.error("[DynamicSvmWalletProvider] Error during configuration:", error);
      throw error;
    }
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign
   * @returns The signature
   */
  public async signMessage(message: string): Promise<string> {
    return this.#dynamicClient.signMessage({
      message,
      accountAddress: this.getAddress(),
    });
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign
   * @returns The signed transaction
   */
  public async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    // Dynamic import for ESM compatibility
    const { DynamicSvmWalletClient: _DynamicSvmWalletClient } = (await import(
      "@dynamic-labs-wallet/node-svm"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;
    const signedTransaction = await (
      this.#dynamicClient as InstanceType<typeof _DynamicSvmWalletClient>
    ).signTransaction({
      senderAddress: this.#accountAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction: transaction as any,
    });
    if (!(signedTransaction instanceof VersionedTransaction)) {
      throw new Error("Expected VersionedTransaction from signTransaction");
    }
    return signedTransaction;
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send
   * @returns The transaction signature
   */
  public async sendTransaction(transaction: VersionedTransaction): Promise<string> {
    const result = await this.#connection.sendTransaction(transaction);
    return result;
  }

  /**
   * Signs and sends a transaction.
   *
   * @param transaction - The transaction to sign and send
   * @returns The transaction signature
   */
  public async signAndSendTransaction(transaction: VersionedTransaction): Promise<string> {
    const signedTransaction = await this.signTransaction(transaction);
    return this.sendTransaction(signedTransaction);
  }

  /**
   * Gets the status of a transaction.
   *
   * @param signature - The transaction signature
   * @param options - Optional configuration for the status check
   * @returns The transaction status
   */
  public async getSignatureStatus(
    signature: string,
    options?: SignatureStatusConfig,
  ): Promise<RpcResponseAndContext<SignatureStatus | null>> {
    return this.#connection.getSignatureStatus(signature, options);
  }

  /**
   * Waits for a transaction signature result.
   *
   * @param signature - The transaction signature
   * @returns The transaction result
   */
  public async waitForSignatureResult(
    signature: string,
  ): Promise<RpcResponseAndContext<SignatureResult>> {
    const status = await this.#connection.getSignatureStatus(signature);
    if (!status.value) {
      throw new Error(`Transaction ${signature} not found`);
    }
    return status as RpcResponseAndContext<SignatureResult>;
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network
   */
  public getNetwork(): Network {
    return SOLANA_NETWORKS[this.#genesisHash];
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The wallet provider name
   */
  public getName(): string {
    return "dynamic_svm_wallet_provider";
  }

  /**
   * Exports the wallet information.
   *
   * @returns The wallet information
   */
  public async exportWallet(): Promise<DynamicWalletExport> {
    return {
      accountAddress: this.#accountAddress,
      networkId: this.getNetwork().networkId,
    };
  }

  /**
   * Gets the Solana connection.
   *
   * @returns The Solana connection
   */
  public getConnection(): Connection {
    return this.#connection;
  }

  /**
   * Gets the public key of the wallet.
   *
   * @returns The public key
   */
  public getPublicKey(): PublicKey {
    return this.#publicKey;
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The wallet address
   */
  public getAddress(): string {
    return this.#accountAddress;
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The wallet balance in lamports
   */
  public async getBalance(): Promise<bigint> {
    const balance = await this.#connection.getBalance(this.#publicKey);
    return BigInt(balance);
  }

  /**
   * Performs a native transfer.
   *
   * @param to - The recipient address
   * @param value - The amount to transfer in SOL (as a decimal string, e.g. "0.0001")
   * @returns The transaction signature
   */
  public async nativeTransfer(to: string, value: string): Promise<string> {
    const initialBalance = await this.getBalance();
    const solAmount = Number.parseFloat(value);
    const lamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));

    // Check if we have enough balance (including estimated fees)
    if (initialBalance < lamports + BigInt(5000)) {
      throw new Error(
        `Insufficient balance. Have ${Number(initialBalance) / LAMPORTS_PER_SOL} SOL, need ${
          solAmount + 0.000005
        } SOL (including fees)`,
      );
    }

    const toPubkey = new PublicKey(to);
    const instructions = [
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 2000,
      }),
      SystemProgram.transfer({
        fromPubkey: this.getPublicKey(),
        toPubkey: toPubkey,
        lamports: lamports,
      }),
    ];

    const tx = new VersionedTransaction(
      MessageV0.compile({
        payerKey: this.getPublicKey(),
        instructions: instructions,
        recentBlockhash: (await this.#connection.getLatestBlockhash()).blockhash,
      }),
    );

    return this.signAndSendTransaction(tx);
  }
}
