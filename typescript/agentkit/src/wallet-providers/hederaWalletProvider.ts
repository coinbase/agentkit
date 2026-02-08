/**
 * Hedera Wallet Provider for AgentKit
 * 
 * Provides Hedera network support for AI agents, including:
 * - HBAR transfers
 * - HCS (Hedera Consensus Service) messaging
 * - Account management
 */

import {
  Client,
  PrivateKey,
  AccountId,
  AccountBalanceQuery,
  TransferTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  Hbar,
} from "@hashgraph/sdk";

/**
 * Network configuration for Hedera
 */
export const HEDERA_MAINNET_NETWORK_ID = "hedera-mainnet";
export const HEDERA_TESTNET_NETWORK_ID = "hedera-testnet";

export interface HederaNetwork {
  networkId: string;
  protocolFamily: "hedera";
  isTestnet: boolean;
}

export const HEDERA_MAINNET_NETWORK: HederaNetwork = {
  networkId: HEDERA_MAINNET_NETWORK_ID,
  protocolFamily: "hedera",
  isTestnet: false,
};

export const HEDERA_TESTNET_NETWORK: HederaNetwork = {
  networkId: HEDERA_TESTNET_NETWORK_ID,
  protocolFamily: "hedera",
  isTestnet: true,
};

export interface HederaWalletProviderConfig {
  /**
   * The Hedera account ID (e.g., "0.0.12345")
   */
  accountId: string;

  /**
   * The private key (ECDSA hex string)
   */
  privateKey: string;

  /**
   * The network to use (mainnet or testnet)
   */
  network?: HederaNetwork;
}

/**
 * Hedera Wallet Provider for AgentKit
 */
export class HederaWalletProvider {
  #client: Client;
  #accountId: AccountId;
  #privateKey: PrivateKey;
  #network: HederaNetwork;

  /**
   * Creates a new HederaWalletProvider
   */
  private constructor(
    client: Client,
    accountId: AccountId,
    privateKey: PrivateKey,
    network: HederaNetwork
  ) {
    this.#client = client;
    this.#accountId = accountId;
    this.#privateKey = privateKey;
    this.#network = network;
  }

  /**
   * Configure and create a HederaWalletProvider
   */
  static async configure(config: HederaWalletProviderConfig): Promise<HederaWalletProvider> {
    const network = config.network || HEDERA_MAINNET_NETWORK;
    const client = network.isTestnet ? Client.forTestnet() : Client.forMainnet();
    
    const accountId = AccountId.fromString(config.accountId);
    const privateKey = PrivateKey.fromStringECDSA(config.privateKey);
    
    client.setOperator(accountId, privateKey);

    return new HederaWalletProvider(client, accountId, privateKey, network);
  }

  /**
   * Get the account ID
   */
  getAccountId(): string {
    return this.#accountId.toString();
  }

  /**
   * Get the network
   */
  getNetwork(): HederaNetwork {
    return this.#network;
  }

  /**
   * Get the EVM address derived from the public key
   */
  getEvmAddress(): string {
    return this.#privateKey.publicKey.toEvmAddress();
  }

  /**
   * Get the account balance
   */
  async getBalance(): Promise<{ hbar: number; tokens: Map<string, number> }> {
    const query = new AccountBalanceQuery().setAccountId(this.#accountId);
    const balance = await query.execute(this.#client);
    
    return {
      hbar: balance.hbars.toBigNumber().toNumber(),
      tokens: new Map(balance.tokens._map),
    };
  }

  /**
   * Transfer HBAR to another account
   */
  async transfer(
    recipientId: string,
    amount: number
  ): Promise<{ transactionId: string; status: string }> {
    const tx = new TransferTransaction()
      .addHbarTransfer(this.#accountId, new Hbar(-amount))
      .addHbarTransfer(recipientId, new Hbar(amount));

    const response = await tx.execute(this.#client);
    const receipt = await response.getReceipt(this.#client);

    return {
      transactionId: response.transactionId.toString(),
      status: receipt.status.toString(),
    };
  }

  /**
   * Create an HCS topic
   */
  async createTopic(memo?: string): Promise<{ topicId: string; transactionId: string }> {
    const tx = new TopicCreateTransaction()
      .setTopicMemo(memo || "")
      .setSubmitKey(this.#privateKey.publicKey);

    const response = await tx.execute(this.#client);
    const receipt = await response.getReceipt(this.#client);

    return {
      topicId: receipt.topicId!.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Submit a message to an HCS topic
   */
  async submitMessage(
    topicId: string,
    message: string | object
  ): Promise<{ sequence: string; transactionId: string }> {
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(typeof message === "string" ? message : JSON.stringify(message));

    const response = await tx.execute(this.#client);
    const receipt = await response.getReceipt(this.#client);

    return {
      sequence: receipt.topicSequenceNumber?.toString() || "0",
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Get messages from an HCS topic via mirror node
   */
  async getMessages(
    topicId: string,
    sinceSequence: number = 0
  ): Promise<Array<{ sequence: number; timestamp: string; message: string }>> {
    const baseUrl = this.#network.isTestnet
      ? "https://testnet.mirrornode.hedera.com"
      : "https://mainnet-public.mirrornode.hedera.com";

    const url = `${baseUrl}/api/v1/topics/${topicId}/messages?sequencenumber=gt:${sinceSequence}&limit=100`;
    const response = await fetch(url);
    const data = await response.json();

    return (data.messages || []).map((msg: any) => ({
      sequence: msg.sequence_number,
      timestamp: msg.consensus_timestamp,
      message: Buffer.from(msg.message, "base64").toString("utf8"),
    }));
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.#client.close();
  }
}

export default HederaWalletProvider;
