/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletProvider } from "./walletProvider";
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  SignatureStatusConfig,
  VersionedTransaction,
  SignatureResult,
} from "@solana/web3.js";

/**
 * SvmWalletProvider is the abstract base class for all Solana wallet providers (non browsers).
 *
 * @abstract
 */
export abstract class SvmWalletProvider extends WalletProvider {
  /**
   * Get the connection instance.
   *
   * @returns The Solana connection instance.
   */
  abstract getConnection(): Connection;

  /**
   * Get the public key of the wallet.
   *
   * @returns The wallet's public key.
   */
  abstract getPublicKey(): PublicKey;

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
   * @returns The signature.
   */
  abstract sendTransaction(transaction: VersionedTransaction): Promise<string>;

  /**
   * Sign and send a transaction.
   *
   * @param transaction - The transaction to sign and send.
   * @returns The signature.
   */
  abstract signAndSendTransaction(transaction: VersionedTransaction): Promise<string>;

  /**
   * Get the status of a transaction.
   *
   * @param signature - The signature.
   * @returns The status.
   */
  abstract getSignatureStatus(
    signature: string,
    options?: SignatureStatusConfig,
  ): Promise<RpcResponseAndContext<SignatureStatus | null>>;

  /**
   * Wait for signature receipt.
   *
   * @param signature - The signature
   * @returns The confirmation response
   */
  abstract waitForSignatureResult(
    signature: string,
  ): Promise<RpcResponseAndContext<SignatureResult>>;
}
