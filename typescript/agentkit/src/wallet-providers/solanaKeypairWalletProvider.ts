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
  RpcResponseAndContext,
  SignatureResult,
  SignatureStatus,
  SignatureStatusConfig,
} from "@solana/web3.js";
import bs58 from "bs58";
import {
  SOLANA_CLUSTER,
  SOLANA_DEVNET_GENESIS_BLOCK_HASH,
  SOLANA_DEVNET_NETWORK_ID,
  SOLANA_MAINNET_GENESIS_BLOCK_HASH,
  SOLANA_MAINNET_NETWORK_ID,
  SOLANA_NETWORK_ID,
  SOLANA_NETWORKS,
  SOLANA_TESTNET_GENESIS_BLOCK_HASH,
  SOLANA_TESTNET_NETWORK_ID,
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
   * Create a new SolanaKeypairWalletProvider from an SVM networkId and a keypair
   *
   * @param networkId - The SVM networkId
   * @param keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
   * @returns The new SolanaKeypairWalletProvider
   */
  static async fromNetwork<T extends SolanaKeypairWalletProvider>(
    networkId: SOLANA_NETWORK_ID,
    keypair: Uint8Array | string,
  ): Promise<T> {
    let genesisHash: SOLANA_CLUSTER;
    switch (networkId) {
      case SOLANA_MAINNET_NETWORK_ID:
        genesisHash = SOLANA_MAINNET_GENESIS_BLOCK_HASH;
        break;
      case SOLANA_DEVNET_NETWORK_ID:
        genesisHash = SOLANA_DEVNET_GENESIS_BLOCK_HASH;
        break;
      case SOLANA_TESTNET_NETWORK_ID:
        genesisHash = SOLANA_TESTNET_GENESIS_BLOCK_HASH;
        break;
      default:
        throw new Error(`${networkId} is not a valid SVM networkId`);
    }
    const rpcUrl = this.urlForCluster(genesisHash);
    return await this.fromRpcUrl(rpcUrl, keypair);
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
   * Get the connection instance
   *
   * @returns The Solana connection instance
   */
  getConnection(): Connection {
    return this.#connection;
  }

  /**
   * Get the public key of the wallet
   *
   * @returns The wallet's public key
   */
  getPublicKey(): PublicKey {
    return this.#keypair.publicKey;
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
   * @returns The signature
   */
  async sendTransaction(transaction: VersionedTransaction): Promise<string> {
    const signature = await this.#connection.sendTransaction(transaction);
    await this.waitForSignatureResult(signature);
    return signature;
  }

  /**
   * Sign and send a transaction
   *
   * @param transaction - The transaction to sign and send
   * @returns The signature
   */
  async signAndSendTransaction(transaction: VersionedTransaction): Promise<string> {
    const signedTransaction = await this.signTransaction(transaction);
    return this.sendTransaction(signedTransaction);
  }

  /**
   * Get the status of a transaction
   *
   * @param signature - The signature
   * @param options - The options for the status
   * @returns The status
   */
  async getSignatureStatus(
    signature: string,
    options?: SignatureStatusConfig,
  ): Promise<RpcResponseAndContext<SignatureStatus | null>> {
    return this.#connection.getSignatureStatus(signature, options);
  }

  /**
   * Wait for signature receipt
   *
   * @param signature - The signature
   * @returns The confirmation response
   */
  async waitForSignatureResult(signature: string): Promise<RpcResponseAndContext<SignatureResult>> {
    const { blockhash, lastValidBlockHeight } = await this.#connection.getLatestBlockhash();
    return this.#connection.confirmTransaction({
      signature: signature,
      lastValidBlockHeight,
      blockhash,
    });
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
   * @param value - The amount of SOL to transfer (as a decimal string, e.g. "0.0001")
   * @returns The signature
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    const initialBalance = await this.getBalance();
    const solAmount = parseFloat(value);
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

    tx.sign([this.#keypair]);

    const signature = await this.#connection.sendTransaction(tx);
    await this.waitForSignatureResult(signature);
    return signature;
  }

  /**
   * Request SOL tokens from the Solana faucet. This method only works on devnet and testnet networks.
   *
   * @param lamports - The amount of lamports (1 SOL = 1,000,000,000 lamports) to request from the faucet
   * @returns A Promise that resolves to the signature of the airdrop
   */
  async requestAirdrop(lamports: number): Promise<string> {
    return await this.#connection.requestAirdrop(this.#keypair.publicKey, lamports);
  }
}
