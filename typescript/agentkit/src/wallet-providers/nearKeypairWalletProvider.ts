import { withRetry } from "viem";

import { Account } from "@near-js/accounts";
import { connect, Near, transactions, utils as nearUtils } from "near-api-js";
import { KeyPair } from "@near-js/crypto";
import { Connection, ConnectionConfig } from "@near-js/accounts";
import { InMemoryKeyStore } from "@near-js/keyStores";
import type { TxExecutionStatus, FinalExecutionOutcome } from "@near-js/types";
import { actionCreators } from "@near-js/transactions";

import { NEAR_MAINNET_NETWORK_ID, NEAR_NETWORK_ID, NEAR_NETWORKS, Network } from "../network";
import { NEARWalletProvider, TransactionSenderParams } from "./nearWalletProvider";

export interface SendTransactionOptions {
  until: TxExecutionStatus;
  retryCount: number;
  delay: number;
  nodeUrl: string;
}

export interface AccessKeyInfo {
  block_hash: string;
  block_height: number;
  nonce: number;
  permission: string;
}

const DEFAULT_OPTIONS: SendTransactionOptions = {
  until: "EXECUTED_OPTIMISTIC",
  retryCount: 3,
  delay: 5000, // Near RPC timeout
  nodeUrl: "https://test.rpc.fastnear.com", // defaults to testnet
};

/**
 * NeaKeypairWalletProvider is a wallet provider that uses a local Near keypair.
 *
 * @augments NEARWalletProvider
 */
export class NearKeypairWalletProvider extends NEARWalletProvider {
  keypair: KeyPair;
  rpcProviderUrl: string;
  network: NEAR_NETWORK_ID;
  accountId: string;
  connection: Connection;
  keyStore: InMemoryKeyStore;
  connectionConfig: ConnectionConfig;

  near: Near | null = null;
  account: Account | null = null;

  /**
   * Creates a new NearKeypairWalletProvider.
   *
   * @param keypair - The keypair to use for signing transactions.
   * @param accountId - The account ID to use for signing transactions.
   * @param rpcProviderUrl - The RPC provider URL.
   * @param network - The network ID.
   *
   * @returns A new NearKeypairWalletProvider.
   */
  constructor(
    keypair: KeyPair,
    accountId: string,
    rpcProviderUrl: string,
    network: NEAR_NETWORK_ID,
  ) {
    super();

    this.keypair = keypair;
    this.rpcProviderUrl = rpcProviderUrl;
    this.accountId = accountId;
    this.network = network;

    this.keyStore = new InMemoryKeyStore();

    this.connectionConfig = {
      networkId: this.network === NEAR_MAINNET_NETWORK_ID ? "mainnet" : "testnet",
      nodeUrl: this.rpcProviderUrl,
      keyStore: this.keyStore,
      jsvmAccountId: this.accountId,
    };
  }

  /**
   * Get the public key of the keypair.
   *
   * @returns The public key of the keypair.
   */
  getPublicKey(): string {
    return this.keypair.getPublicKey().toString();
  }

  /**
   * Get the address of the wallet provider.
   *
   * @returns The address of the wallet provider.
   */
  getAddress(): string {
    return this.accountId;
  }

  /**
   * Get the network of the wallet provider.
   *
   * @returns The network of the wallet provider.
   */
  getNetwork(): Network {
    return NEAR_NETWORKS[this.network];
  }

  /**
   * Get the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  getName(): string {
    return "near_keypair_wallet_provider";
  }

  /**
   * Get the connection of the wallet provider.
   *
   * @returns The connection of the wallet
   */
  async getConnection(): Promise<Connection> {
    await this.connectIfNeeded();
    return this.connection;
  }

  /**
   * Get the NEAR account of the wallet provider.
   *
   * @returns The NEAR account of the wallet provider.
   */
  async getAccount(): Promise<Account> {
    await this.connectIfNeeded();
    return this.account!;
  }

  /**
   * Get the balance of the native asset of the network.
   *
   * @returns The balance of the native asset of the network.
   */
  async getBalance(): Promise<bigint> {
    await this.connectIfNeeded();
    const balance = await this.account.getAccountBalance();
    return BigInt(balance.available);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH)
   * @returns The transaction hash
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    await this.connectIfNeeded();
    const amountYocto = nearUtils.format.parseNearAmount(value);
    if (!amountYocto) {
      throw new Error("Error converting amount to yoctonear");
    }
    const action = actionCreators.transfer(BigInt(amountYocto));
    const outcome = await this.account.signAndSendTransaction({
      receiverId: to,
      actions: [action],
    });
    return outcome.transaction.hash;
  }

  /**
   * Sign and send a transaction.
   *
   * @param args - The transaction sender parameters.
   * @param options - The send transaction options.
   *
   * @returns The final execution outcome
   */
  async signAndSendTransaction(
    args: TransactionSenderParams,
    options: SendTransactionOptions = DEFAULT_OPTIONS,
  ): Promise<FinalExecutionOutcome> {
    await this.connectIfNeeded();
    const accountId = this.accountId;

    const { signer } = this.near.connection;
    const connection = this.near.connection;

    const publicKey = await signer.getPublicKey(accountId, connection.networkId);

    const accessKey = (await connection.provider.query(
      `access_key/${accountId}/${publicKey.toString()}`,
      "",
    )) as AccessKeyInfo;

    if (!accessKey) {
      throw new Error("Access key not found");
    }

    const recentBlockHash = nearUtils.serialize.base_decode(accessKey.block_hash);

    const tx = transactions.createTransaction(
      accountId,
      publicKey,
      args.receiverId,
      ++accessKey.nonce,
      args.actions,
      recentBlockHash,
    );

    const serializedTx = nearUtils.serialize.serialize(transactions.SCHEMA.Transaction, tx);

    const nearTransactionSignature = await signer.signMessage(
      serializedTx,
      accountId,
      connection.networkId,
    );

    const signedTransaction = new transactions.SignedTransaction({
      transaction: tx,
      signature: new transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: nearTransactionSignature.signature,
      }),
    });
    const { transaction } = await connection.provider.sendTransactionUntil(
      signedTransaction,
      "INCLUDED_FINAL",
    );

    const txHash = transaction.hash as string | undefined;

    if (!txHash) {
      throw new Error("No transaction hash found");
    }

    return await withRetry(
      async () => {
        const txOutcome = await connection.provider.txStatus(txHash, accountId, options.until);

        if (txOutcome) {
          return txOutcome;
        }

        throw new Error("Transaction not found");
      },
      {
        retryCount: options.retryCount,
        delay: options.delay,
      },
    );
  }

  /**
   * Connect to the Near network if needed.
   *
   * @returns A Promise that resolves when the connection is established.
   */
  async connectIfNeeded() {
    if (!this.near) {
      const key = this.network === NEAR_MAINNET_NETWORK_ID ? "mainnet" : "testnet";
      await this.keyStore.setKey(key, this.accountId, this.keypair);
      this.near = await connect(this.connectionConfig);
      this.connection = this.near.connection;
      this.account = await this.near.account(this.accountId);
    }
  }
}
