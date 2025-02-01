// TODO: Improve type safety
/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletProvider } from "./walletProvider";
import { TransactionRequest, ReadContractParameters, ReadContractReturnType } from "viem";

/**
 * EvmWalletProvider is the abstract base class for all EVM wallet providers.
 *
 * @abstract
 */
export abstract class EvmWalletProvider extends WalletProvider {
  /**
   * Sign a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  abstract signMessage(message: string | Uint8Array): Promise<`0x${string}`>;

  /**
   * Sign a typed data.
   *
   * @param typedData - The typed data to sign.
   * @returns The signed typed data.
   */
  abstract signTypedData(typedData: any): Promise<`0x${string}`>;

  /**
   * Sign a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  abstract signTransaction(transaction: TransactionRequest): Promise<`0x${string}`>;

  /**
   * Send a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The transaction hash.
   */
  abstract sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`>;

  /**
   * Wait for a transaction receipt.
   *
   * @param txHash - The transaction hash.
   * @returns The transaction receipt.
   */
  abstract waitForTransactionReceipt(txHash: `0x${string}`): Promise<any>;

  /**
   * Read a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  abstract readContract(params: ReadContractParameters): Promise<ReadContractReturnType>;
}
