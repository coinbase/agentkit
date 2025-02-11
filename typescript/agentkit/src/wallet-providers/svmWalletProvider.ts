/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletProvider } from "./walletProvider";
import { VersionedTransaction } from "@solana/web3.js";

/**
 * SvmWalletProvider is the abstract base class for all Solana wallet providers (non browsers).
 *
 * @abstract
 */
export abstract class SvmWalletProvider extends WalletProvider {
  /**
   * Sign a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  abstract signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;

  /**
   * Send a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The transaction hash.
   */
  abstract sendTransaction(transaction: VersionedTransaction): Promise<string>;

  /**
   * Wait for a transaction receipt.
   *
   * @param txHash - The transaction hash.
   * @returns The transaction receipt.
   */
  abstract waitForTransactionReceipt(txHash: string): Promise<any>;
}
