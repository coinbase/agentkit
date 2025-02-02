import { SvmWalletProvider } from "./svmWalletProvider";
import { Network } from "../network";
import { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram, MessageV0, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { SOLANA_MAINNET_CHAIN_ID, SOLANA_MAINNET_NETWORK_ID, SOLANA_PROTOCOL_FAMILY, SOLANA_MAINNET_GENESIS_BLOCK_HASH, SOLANA_TESTNET_CHAIN_ID, SOLANA_TESTNET_NETWORK_ID, SOLANA_DEVNET_GENESIS_BLOCK_HASH, SOLANA_DEVNET_CHAIN_ID, SOLANA_DEVNET_NETWORK_ID, SOLANA_TESTNET_GENESIS_BLOCK_HASH } from "../network/svm";

export class SvmKeypairWalletProvider extends SvmWalletProvider {
    #keypair: Keypair;
    #connection: Connection;

    /**
     * Creates a new SvmKeypairWalletProvider
     * @param keypair - Either a Uint8Array or a base58 encoded string representing a 32-byte secret key
     * @param rpcUrl - URL of the Solana RPC endpoint
     */
    constructor({
        keypair,
        rpcUrl,
    }: {
        keypair: Uint8Array | string,
        rpcUrl: string,
    }) {
        super();

        this.#keypair = typeof keypair === "string" ? Keypair.fromSecretKey(bs58.decode(keypair)) : Keypair.fromSecretKey(keypair);
        this.#connection = new Connection(rpcUrl);
    }

    getAddress(): string {
        return this.#keypair.publicKey.toBase58();
    }

    async getNetwork(): Promise<Network> {
        const hash = await this.#connection.getGenesisHash();
        if (hash === SOLANA_MAINNET_GENESIS_BLOCK_HASH) {
            return {
                protocolFamily: SOLANA_PROTOCOL_FAMILY,
                chainId: String(SOLANA_MAINNET_CHAIN_ID),
                networkId: SOLANA_MAINNET_NETWORK_ID,
            };
        } else if (hash === SOLANA_TESTNET_GENESIS_BLOCK_HASH) {
            return {
                protocolFamily: SOLANA_PROTOCOL_FAMILY,
                chainId: String(SOLANA_TESTNET_CHAIN_ID),
                networkId: SOLANA_TESTNET_NETWORK_ID,
            };
        } else if (hash === SOLANA_DEVNET_GENESIS_BLOCK_HASH) {
            return {
                protocolFamily: SOLANA_PROTOCOL_FAMILY,
                chainId: String(SOLANA_DEVNET_CHAIN_ID),
                networkId: SOLANA_DEVNET_NETWORK_ID,
            };
        } else {
            throw new Error(`Unknown network with genesis hash: ${hash}`);
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
