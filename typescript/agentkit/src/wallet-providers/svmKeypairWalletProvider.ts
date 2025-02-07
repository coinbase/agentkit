import { SvmWalletProvider } from "./svmWalletProvider";
import { Network } from "../network";
import { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram, MessageV0, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { SOLANA_NETWORKS } from "../network/svm";

export class SvmKeypairWalletProvider extends SvmWalletProvider {
    #keypair: Keypair;
    #connection: Connection;
    #genesisHash: string;

    /**
     * Creates a new SvmKeypairWalletProvider
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
        this.#genesisHash = genesisHash;
    }

    getAddress(): string {
        return this.#keypair.publicKey.toBase58();
    }

    getNetwork(): Network {
        if (this.#genesisHash in SOLANA_NETWORKS) {
            return SOLANA_NETWORKS[this.#genesisHash];
        } else {
            throw new Error(`Unknown network with genesis hash: ${this.#genesisHash}`);
        }
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
        return "svm_keypair_wallet_provider";
    }

    getBalance(): Promise<bigint> {
        return this.#connection.getBalance(this.#keypair.publicKey).then(balance => BigInt(balance))
    }

    // Assumes `to` is a hex encoded address that we'll convert to a Solana PublicKey
    async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
        const toPubkey = new PublicKey(Buffer.from(to.slice(2), "hex"));
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
        return `0x${Buffer.from(bs58.decode(txHash)).toString("hex")}`;
    }
}
