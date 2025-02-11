import { SvmWalletProvider } from "./svmWalletProvider";
import { Network } from "../network";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  MessageV0,
  ComputeBudgetProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import {
  SOLANA_CLUSTER,
  SOLANA_DEVNET_GENESIS_BLOCK_HASH,
  SOLANA_MAINNET_GENESIS_BLOCK_HASH,
  SOLANA_NETWORKS,
  SOLANA_TESTNET_GENESIS_BLOCK_HASH,
} from "../network/svm";

/**
 * SolanaKeypairWalletProvider is a wallet provider that uses a local Solana keypair.
 *
 * @augments SvmWalletProvider
 */
export class SolanaKeypairWalletProvider extends SvmWalletProvider {
  #keypair: Keypair;
  #connection: Connection;
  #genesisHash: string;

  /**
   * Creates a new SolanaKeypairWalletProvider
   *
   * @param args - Configuration arguments
   * @param args.keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
   * @param args.rpcUrl - URL of the Solana RPC endpoint
   * @param args.genesisHash - The genesis hash of the network
   */
  constructor({
    keypair,
    rpcUrl,
    genesisHash,
  }: {
    keypair: Uint8Array | string;
    rpcUrl: string;
    genesisHash: string;
  }) {
    super();

    this.#keypair =
      typeof keypair === "string"
        ? Keypair.fromSecretKey(bs58.decode(keypair))
        : Keypair.fromSecretKey(keypair);
    this.#connection = new Connection(rpcUrl);
    if (genesisHash in SOLANA_NETWORKS) {
      this.#genesisHash = genesisHash;
    } else {
      throw new Error(`Unknown network with genesis hash: ${genesisHash}`);
    }
  }

  /**
   * Get the default RPC URL for a Solana cluster
   *
   * @param cluster - The cluster to get the RPC URL for
   * @returns The RPC URL for the cluster
   */
  static urlForCluster(cluster: SOLANA_CLUSTER): string {
    if (cluster in SOLANA_NETWORKS) {
      switch (cluster) {
        case SOLANA_MAINNET_GENESIS_BLOCK_HASH:
          return clusterApiUrl("mainnet-beta");
        case SOLANA_TESTNET_GENESIS_BLOCK_HASH:
          return clusterApiUrl("testnet");
        case SOLANA_DEVNET_GENESIS_BLOCK_HASH:
          return clusterApiUrl("devnet");
        default:
          throw new Error(`Unknown cluster: ${cluster}`);
      }
    } else {
      throw new Error(`Unknown cluster: ${cluster}`);
    }
  }

  /**
   * Create a new SolanaKeypairWalletProvider from an RPC URL and a keypair
   *
   * @param rpcUrl - The URL of the Solana RPC endpoint
   * @param keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
   * @returns The new SolanaKeypairWalletProvider
   */
  static async fromRpcUrl<T extends SolanaKeypairWalletProvider>(
    rpcUrl: string,
    keypair: Uint8Array | string,
  ): Promise<T> {
    const connection = new Connection(rpcUrl);
    return await this.fromConnection(connection, keypair);
  }

  /**
   * Create a new SolanaKeypairWalletProvider from a Connection and a keypair
   *
   * @param connection - The Connection to use
   * @param keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
   * @returns The new SolanaKeypairWalletProvider
   */
  static async fromConnection<T extends SolanaKeypairWalletProvider>(
    connection: Connection,
    keypair: Uint8Array | string,
  ): Promise<T> {
    const genesisHash = await connection.getGenesisHash();
    return new SolanaKeypairWalletProvider({
      keypair,
      rpcUrl: connection.rpcEndpoint,
      genesisHash: genesisHash,
    }) as T;
  }

  /**
   * Get the address of the wallet
   *
   * @returns The base58 encoded address of the wallet
   */
  getAddress(): string {
    return this.#keypair.publicKey.toBase58();
  }

  /**
   * Get the network
   *
   * @returns The network
   */
  getNetwork(): Network {
    return SOLANA_NETWORKS[this.#genesisHash];
  }

  /**
   * Sign a transaction
   *
   * @param transaction - The transaction to sign
   * @returns The signed transaction
   */
  async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    transaction.sign([this.#keypair]);
    return transaction;
  }

  /**
   * Send a transaction
   *
   * @param transaction - The transaction to send
   * @returns The transaction hash
   */
  sendTransaction(transaction: VersionedTransaction): Promise<string> {
    return this.#connection.sendTransaction(transaction);
  }

  /**
   * Wait for a transaction receipt
   *
   * @param txHash - The transaction hash
   * @returns The transaction receipt
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitForTransactionReceipt(txHash: string): Promise<any> {
    return this.#connection.confirmTransaction(txHash);
  }

  /**
   * Get the name of the wallet provider
   *
   * @returns The name of the wallet provider
   */
  getName(): string {
    return "solana_keypair_wallet_provider";
  }

  /**
   * Get the balance of the wallet
   *
   * @returns The balance of the wallet
   */
  getBalance(): Promise<bigint> {
    return this.#connection.getBalance(this.#keypair.publicKey).then(balance => BigInt(balance));
  }

  /**
   * Transfer SOL from the wallet to another address
   *
   * @param to - The base58 encoded address to transfer the SOL to
   * @param value - The amount of SOL to transfer
   * @returns The transaction hash
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    const toPubkey = new PublicKey(to);
    const lamports = BigInt(LAMPORTS_PER_SOL) * BigInt(value);

    const instructions = [
      ComputeBudgetProgram.setComputeUnitPrice({
        // TODO: Make this configurable
        microLamports: 10000,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 2000,
      }),
      SystemProgram.transfer({
        fromPubkey: this.#keypair.publicKey,
        toPubkey: toPubkey,
        lamports: lamports,
      }),
    ];
    const tx = new VersionedTransaction(
      MessageV0.compile({
        payerKey: this.#keypair.publicKey,
        instructions: instructions,
        recentBlockhash: (await this.#connection.getLatestBlockhash()).blockhash,
      }),
    );

    const txHash = await this.#connection.sendTransaction(tx);
    return txHash;
  }
}
