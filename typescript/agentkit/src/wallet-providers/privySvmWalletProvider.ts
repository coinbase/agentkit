import { PrivyClient, SolanaCaip2ChainId } from "@privy-io/server-auth";
import { SvmWalletProvider } from "./svmWalletProvider";
import {
  RpcResponseAndContext,
  SignatureStatus,
  VersionedTransaction,
  Connection,
  PublicKey,
  SignatureResult,
  clusterApiUrl,
} from "@solana/web3.js";
import { SOLANA_NETWORKS, SOLANA_CLUSTER_ID_BY_NETWORK_ID } from "../network/svm";
import { Network } from "../network/types";
import { createPrivyWallet, PrivyWalletConfig, PrivyWalletExport } from "./privyShared";

/**
 * Configuration options for the Privy Svm wallet provider.
 */
export interface PrivySvmWalletConfig extends PrivyWalletConfig {
  /** The network ID to use for the wallet */
  networkId?: string;
  /** The connection to use for the wallet */
  connection?: Connection;
  /** The wallet type to use */
  walletType: "server";
}

/**
 * A wallet provider that uses Privy's server wallet API.
 * This provider extends the SvmWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivySvmWalletProvider extends SvmWalletProvider {
  #walletId: string;
  #address: string;
  #authorizationPrivateKey: string | undefined;
  #privyClient: PrivyClient;
  #connection: Connection;
  #genesisHash: string;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param config - The configuration options for the Privy wallet
   */
  private constructor(
    config: PrivySvmWalletConfig & {
      walletId: string;
      address: string;
      privyClient: PrivyClient;
      connection: Connection;
      genesisHash: string;
    },
  ) {
    super();

    this.#walletId = config.walletId;
    this.#address = config.address;
    this.#authorizationPrivateKey = config.authorizationPrivateKey;
    this.#privyClient = config.privyClient;
    this.#connection = config.connection;
    this.#genesisHash = config.genesisHash;
  }

  /**
   * Creates and configures a new PrivySolanaWalletProvider instance.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured PrivySolanaWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await PrivySolanaWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   walletId: "wallet-id",
   * });
   * ```
   */
  public static async configureWithWallet<T extends PrivySvmWalletProvider>(
    config: PrivySvmWalletConfig,
  ): Promise<T> {
    const { wallet, privy } = await createPrivyWallet({
      ...config,
      chainType: "solana",
    });

    const connection =
      config.connection ??
      new Connection(clusterApiUrl(SOLANA_CLUSTER_ID_BY_NETWORK_ID[config.networkId ?? ""]));

    return new PrivySvmWalletProvider({
      ...config,
      walletId: wallet.id,
      address: wallet.address,
      privyClient: privy,
      connection,
      genesisHash: await connection.getGenesisHash(),
    }) as T;
  }

  /**
   * Sign a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    const { signedTransaction } = await this.#privyClient.walletApi.solana.signTransaction({
      walletId: this.#walletId,
      transaction,
    });

    return signedTransaction as VersionedTransaction;
  }

  /**
   * Sign and send a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The transaction hash.
   */
  async signAndSendTransaction(transaction: VersionedTransaction): Promise<string> {
    try {
      const { hash } = await this.#privyClient.walletApi.solana.signAndSendTransaction({
        walletId: this.#walletId,
        caip2: `solana:${this.#genesisHash.substring(0, 32)}` as SolanaCaip2ChainId,
        transaction,
      });

      return hash;
    } catch (error) {
      console.error("Failed to send transaction", error);
      throw new Error("Failed to send transaction");
    }
  }

  /**
   * Send a transaction.
   *
   * @param _ - The transaction to send.
   * @returns The transaction hash.
   */
  async sendTransaction(_: VersionedTransaction): Promise<string> {
    throw new Error("Method not implemented.");
  }

  /**
   * Exports the wallet data.
   *
   * @returns The wallet data
   */
  exportWallet(): PrivyWalletExport {
    return {
      walletId: this.#walletId,
      authorizationPrivateKey: this.#authorizationPrivateKey,
      chainId: this.getNetwork().chainId,
      networkId: this.getNetwork().networkId,
    };
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The string identifier for this wallet provider
   */
  getName(): string {
    return "privy_svm_wallet_provider";
  }

  /**
   * Get the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    return this.#address;
  }

  /**
   * Get the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return SOLANA_NETWORKS[this.#genesisHash];
  }

  /**
   * Get the balance of the wallet.
   *
   * @returns The balance of the wallet.
   */
  async getBalance(): Promise<bigint> {
    const balance = await this.#connection.getBalance(new PublicKey(this.#address));
    return BigInt(balance);
  }

  /**
   * Transfer a native token.
   *
   * @param _ - The address to transfer the token to.
   * @param arg2 - The value to transfer.
   * @returns The transaction hash.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async nativeTransfer(_: string, arg2: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  /**
   * Get the status of a transaction.
   *
   * @param signature - The transaction signature.
   * @returns The transaction status.
   */
  async getSignatureStatus(
    signature: string,
  ): Promise<RpcResponseAndContext<SignatureStatus | null>> {
    return this.#connection.getSignatureStatus(signature);
  }

  /**
   * Wait for a signature result.
   *
   * @param signature - The signature to wait for.
   * @returns The signature result.
   */
  waitForSignatureResult(signature: string): Promise<RpcResponseAndContext<SignatureResult>> {
    return this.#connection.confirmTransaction({
      signature,
      ...SOLANA_NETWORKS[this.#genesisHash],
    });
  }

  /**
   * Get the connection.
   *
   * @returns The connection.
   */
  getConnection(): Connection {
    return this.#connection;
  }

  /**
   * Get the public key.
   *
   * @returns The public key.
   */
  getPublicKey(): PublicKey {
    return new PublicKey(this.#address);
  }
}
