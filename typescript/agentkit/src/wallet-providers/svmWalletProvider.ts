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
import {
  isKeyPairSigner,
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
} from "@solana/kit";

/**
 * SvmWalletProvider is the abstract base class for all Solana wallet providers (non browsers).
 *
 * @abstract
 */
export abstract class SvmWalletProvider extends WalletProvider {
  /**
   * Convert the wallet provider to a KeyPairSigner.
   *
   * @returns The KeyPairSigner instance
   */
  async toSigner(): Promise<KeyPairSigner> {
    return this.getKeyPairSigner();
  }

  /**
   * Check if this wallet's signer is a valid KeyPairSigner.
   *
   * @returns True if the signer is a valid KeyPairSigner, false otherwise
   */
  async isKeyPairSigner(): Promise<boolean> {
    try {
      const signer = await this.toSigner();
      return isKeyPairSigner(signer);
    } catch {
      return false;
    }
  }

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

  /**
   * Sign a message.
   *
   * @param message - The message to sign as a Uint8Array
   * @returns The signature as a Uint8Array
   */
  abstract signMessage(message: Uint8Array): Promise<Uint8Array>;

  /**
   * Get the keypair for this wallet.
   *
   * @returns The CryptoKeyPair for KeyPairSigner compatibility
   */
  abstract getKeyPairSigner(): Promise<KeyPairSigner>;
}

/**
 * Create a KeyPairSigner from raw bytes.
 *
 * @param bytes - The raw key bytes (32 bytes for private key only, 64 bytes for private + public key)
 * @returns A KeyPairSigner instance
 * @throws Error if the byte length is not 32 or 64
 */
export async function createSignerFromBytes(bytes: Uint8Array): Promise<KeyPairSigner> {
  // generate a keypair signer from the bytes based on the byte-length
  // 64 bytes represents concatenated private + public key
  if (bytes.length === 64) {
    return await createKeyPairSignerFromBytes(bytes);
  }
  // 32 bytes represents only the private key
  if (bytes.length === 32) {
    return await createKeyPairSignerFromPrivateKeyBytes(bytes);
  }
  throw new Error(`Unexpected key length: ${bytes.length}. Expected 32 or 64 bytes.`);
}
