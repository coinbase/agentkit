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
  Abi,
  ContractFunctionName,
  ContractFunctionArgs,
} from "viem";
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import { CHAIN_ID_TO_NETWORK_ID } from "../network/network";
import { applyGasMultiplier } from "../utils";

/**
 * Configuration for gas multipliers.
 */
export interface ViemWalletProviderGasConfig {
  /**
   * An internal multiplier on gas limit estimation.
   */
  gasLimitMultiplier?: number;

  /**
   * An internal multiplier on fee per gas estimation.
   */
  feePerGasMultiplier?: number;
}

/**
 * A wallet provider that uses the Viem library.
 */
export class ViemWalletProvider extends EvmWalletProvider {
  #walletClient: ViemWalletClient;
  #publicClient: ViemPublicClient;
  #gasLimitMultiplier: number;
  #feePerGasMultiplier: number;

  /**
   * Constructs a new ViemWalletProvider.
   *
   * @param walletClient - The wallet client.
   * @param gasConfig - Configuration for gas multipliers.
   */
  constructor(walletClient: ViemWalletClient, gasConfig?: ViemWalletProviderGasConfig) {
    super();

    this.#walletClient = walletClient;
    this.#publicClient = createPublicClient({
      chain: walletClient.chain,
      transport: http(),
    });
    this.#gasLimitMultiplier = Math.max(gasConfig?.gasLimitMultiplier ?? 1.2, 1);
    this.#feePerGasMultiplier = Math.max(gasConfig?.feePerGasMultiplier ?? 1, 1);
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

    const feeData = await this.#publicClient.estimateFeesPerGas();
    const maxFeePerGas = applyGasMultiplier(feeData.maxFeePerGas, this.#feePerGasMultiplier);
    const maxPriorityFeePerGas = applyGasMultiplier(
      feeData.maxPriorityFeePerGas,
      this.#feePerGasMultiplier,
    );

    const gasLimit = await this.#publicClient.estimateGas({
      account,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
    });
    const gas = BigInt(Math.round(Number(gasLimit) * this.#gasLimitMultiplier));

    const txParams = {
      account: account,
      chain: chain,
      data: transaction.data,
      to: transaction.to,
      value: transaction.value,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
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
  async readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>> {
    return this.#publicClient.readContract<abi, functionName, args>(params);
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
