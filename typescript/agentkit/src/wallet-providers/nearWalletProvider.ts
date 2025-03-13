import { Connection, Account, SignAndSendTransactionOptions } from "@near-js/accounts";
import type { FinalExecutionOutcome } from "@near-js/types";
import type { Action as TransactionAction } from "@near-js/transactions";

import { Network } from "../network";
import { WalletProvider } from "./walletProvider";

export interface TransactionSenderParams {
  receiverId: string;
  actions: TransactionAction[];
}

/**
 * NEAR Wallet Provider is the abstract base class for all NEAR wallet providers (non browsers).
 *
 * @abstract
 */
export abstract class NEARWalletProvider extends WalletProvider {
  /**
   * Get the address of the wallet provider.
   *
   * @returns The address of the wallet provider.
   */
  abstract getAddress(): string;

  /**
   * Get the network of the wallet provider.
   *
   * @returns The network of the wallet provider.
   */
  abstract getNetwork(): Network;

  /**
   * Get the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  abstract getName(): string;

  /**
   * Get the balance of the native asset of the network.
   *
   * @returns The balance of the native asset of the network.
   */
  abstract getBalance(): Promise<bigint>;

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH)
   * @returns The transaction hash.
   */
  abstract nativeTransfer(to: string, value: string): Promise<string>;

  /**
   * Get the connection of the wallet provider.
   *
   * @returns The connection of the wallet provider.
   */
  abstract getConnection(): Connection;

  /**
   * Get the NEAR account of the wallet provider.
   *
   * @returns The NEAR account of the wallet provider.
   */
  abstract getAccount(): Promise<Account>;

  /**
   * Get the public key of the wallet.
   *
   * @returns The wallet's public key.
   */
  abstract getPublicKey(): string;

  /**
   * Sign and send a transaction.
   *
   * @param values - The options for signing and sending the transaction.
   *
   * @returns The signature and transaction hash.
   */
  abstract signAndSendTransaction(
    values: SignAndSendTransactionOptions,
  ): Promise<FinalExecutionOutcome>;
}
