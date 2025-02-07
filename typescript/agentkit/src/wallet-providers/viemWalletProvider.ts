// TODO: Improve type safety
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  WalletClient as ViemWalletClient,
  createPublicClient,
  http,
  TransactionRequest,
  PublicClient as ViemPublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  parseEther,
} from "viem";
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import { CHAIN_ID_TO_NETWORK_ID } from "../network/network";

/**
 * A wallet provider that uses the Viem library.
 */
export class ViemWalletProvider extends EvmWalletProvider {
  #walletClient: ViemWalletClient;
  #publicClient: ViemPublicClient;

  /**
   * Constructs a new ViemWalletProvider.
   *
   * @param walletClient - The wallet client.
   */
  constructor(walletClient: ViemWalletClient) {
    super();
    this.#walletClient = walletClient;
    this.#publicClient = createPublicClient({
      chain: walletClient.chain,
      transport: http(),
    });
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    return this.#walletClient.signMessage({ account, message });
  }

  /**
   * Signs a typed data object.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    return this.#walletClient.signTypedData({
      account: this.#walletClient.account!,
      domain: typedData.domain!,
      types: typedData.types!,
      primaryType: typedData.primaryType!,
      message: typedData.message!,
    });
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const txParams = {
      account: this.#walletClient.account!,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      chain: this.#walletClient.chain,
    };

    return this.#walletClient.signTransaction(txParams);
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    const chain = this.#walletClient.chain;
    if (!chain) {
      throw new Error("Chain not found");
    }

    const txParams = {
      account: account,
      chain: chain,
      data: transaction.data,
      to: transaction.to,
      value: transaction.value,
    };

    return this.#walletClient.sendTransaction(txParams);
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    return this.#walletClient.account?.address ?? "";
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return {
      protocolFamily: "evm" as const,
      chainId: String(this.#walletClient.chain!.id!),
      networkId: CHAIN_ID_TO_NETWORK_ID[this.#walletClient.chain!.id!],
    };
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  getName(): string {
    return "viem_wallet_provider";
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet.
   */
  async getBalance(): Promise<bigint> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    return this.#publicClient.getBalance({ address: account.address });
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return await this.#publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  async readContract(params: ReadContractParameters): Promise<ReadContractReturnType> {
    return this.#publicClient.readContract(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH)
   * @returns The transaction hash.
   */
  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    const atomicAmount = parseEther(value);

    const tx = await this.sendTransaction({
      to: to,
      value: atomicAmount,
    });

    const receipt = await this.waitForTransactionReceipt(tx);

    if (!receipt) {
      throw new Error("Transaction failed");
    }

    return receipt.transactionHash;
  }
}
