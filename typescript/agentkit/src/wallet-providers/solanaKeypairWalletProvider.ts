import { SvmWalletProvider } from "./svmWalletProvider";
import { Network } from "../network";
import { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram, MessageV0, ComputeBudgetProgram, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";
import { SOLANA_CLUSTER, SOLANA_DEVNET_GENESIS_BLOCK_HASH, SOLANA_MAINNET_GENESIS_BLOCK_HASH, SOLANA_NETWORKS, SOLANA_TESTNET_GENESIS_BLOCK_HASH } from "../network/svm";

export class SolanaKeypairWalletProvider extends SvmWalletProvider {
    #keypair: Keypair;
    #connection: Connection;
    #genesisHash: string;

    /**
     * Creates a new SolanaKeypairWalletProvider
     * @param keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
     * @param rpcUrl - URL of the Solana RPC endpoint
     */
    constructor({
        keypair,
        rpcUrl,
        genesisHash,
    }: {
        keypair: Uint8Array | string,
        rpcUrl: string,
        genesisHash: string,
    }) {
        super();

        this.#keypair = typeof keypair === "string" ? Keypair.fromSecretKey(bs58.decode(keypair)) : Keypair.fromSecretKey(keypair);
        this.#connection = new Connection(rpcUrl);
        if (genesisHash in SOLANA_NETWORKS) {
            this.#genesisHash = genesisHash;
        } else {
            throw new Error(`Unknown network with genesis hash: ${genesisHash}`);
        }
    }

    static urlForCluster(cluster: SOLANA_CLUSTER): string {
        if (cluster in SOLANA_NETWORKS) {
            switch (cluster) {
                case SOLANA_MAINNET_GENESIS_BLOCK_HASH:
                    return clusterApiUrl('mainnet-beta');
                case SOLANA_TESTNET_GENESIS_BLOCK_HASH:
                    return clusterApiUrl('testnet');
                case SOLANA_DEVNET_GENESIS_BLOCK_HASH:
                    return clusterApiUrl('devnet');
                default:
                    throw new Error(`Unknown cluster: ${cluster}`);
            }
        } else {
            throw new Error(`Unknown cluster: ${cluster}`);
        }
    }

    static async fromRpcUrl<T extends SolanaKeypairWalletProvider>(rpcUrl: string, keypair: Uint8Array | string): Promise<T> {
        const connection = new Connection(rpcUrl);
        return await this.fromConnection(connection, keypair);
    }

    static async fromConnection<T extends SolanaKeypairWalletProvider>(connection: Connection, keypair: Uint8Array | string): Promise<T> {
        const genesisHash = await connection.getGenesisHash();
        return new SolanaKeypairWalletProvider({
            keypair,
            rpcUrl: connection.rpcEndpoint,
            genesisHash: genesisHash,
        }) as T;
    }

    getAddress(): string {
        return this.#keypair.publicKey.toBase58();
    }

    getNetwork(): Network {
        return SOLANA_NETWORKS[this.#genesisHash];
    }

    signTransaction(transaction: VersionedTransaction): VersionedTransaction {
        transaction.sign([this.#keypair])
        return transaction
    }

    sendTransaction(transaction: VersionedTransaction): Promise<string> {
        return this.#connection.sendTransaction(transaction);
    }

    waitForTransactionReceipt(txHash: string): Promise<any> {
        return this.#connection.confirmTransaction(txHash);
    }

    getName(): string {
        return "solana_keypair_wallet_provider";
    }

    getBalance(): Promise<bigint> {
        return this.#connection.getBalance(this.#keypair.publicKey).then(balance => BigInt(balance))
    }

    async nativeTransfer(to: string, value: string): Promise<string> {
        const toPubkey = new PublicKey(to);
        const lamports = BigInt(LAMPORTS_PER_SOL) * BigInt(value)

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
            })
        ]
        const tx = new VersionedTransaction(MessageV0.compile({
            payerKey: this.#keypair.publicKey,
            instructions: instructions,
            recentBlockhash: (await this.#connection.getLatestBlockhash()).blockhash,
        }));

        const txHash = await this.#connection.sendTransaction(tx);
        return txHash;
    }
}
