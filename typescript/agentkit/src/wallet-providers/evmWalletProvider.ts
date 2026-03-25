// TODO: Improve type safety
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toAccount } from "viem/accounts";
import { WalletProvider } from "./walletProvider";
import {
  TransactionRequest,
  ReadContractParameters,
  ReadContractReturnType,
  ContractFunctionName,
  Abi,
  ContractFunctionArgs,
  Address,
  PublicClient,
  LocalAccount,
  numberToHex,
} from "viem";

/**
 * Minimal EIP-1193 provider interface.
 */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

/**
 * EvmWalletProvider is the abstract base class for all EVM wallet providers.
 *
 * @abstract
 */
export abstract class EvmWalletProvider extends WalletProvider {
  /**
   * Convert the wallet provider to a Signer.
   *
   * @returns The signer.
   */
  toSigner(): LocalAccount {
    return toAccount({
      type: "local",
      address: this.getAddress() as Address,
      sign: async ({ hash }) => {
        return this.sign(hash as `0x${string}`);
      },
      signMessage: async ({ message }) => {
        return this.signMessage(message as string | Uint8Array);
      },
      signTransaction: async transaction => {
        return this.signTransaction(transaction as TransactionRequest);
      },
      signTypedData: async typedData => {
        return this.signTypedData(typedData);
      },
    });
  }

  /**
   * Convert the wallet provider to a EIP-1193 provider.
   *
   * @returns The EIP-1193 provider.
   */
  toEip1193Provider(): EIP1193Provider {
    return {
      request: async (args: { method: string; params?: any }) => {
        switch (args.method) {
          case "eth_accounts":
          case "eth_requestAccounts":
            return [this.getAddress()];

          case "eth_chainId":
            return numberToHex(Number(this.getNetwork().chainId));

          case "eth_sendTransaction": {
            const txParams = (args.params as any[])?.[0] ?? {};
            const hash = await this.sendTransaction(txParams);
            // Wait for the transaction receipt so that a userOpHash is resolved to a real transaction hash for CDP smart wallets.
            const receipt = await this.waitForTransactionReceipt(hash);
            return receipt.transactionHash ?? hash;
          }

          case "personal_sign": {
            const [message] = args.params as [string];
            return this.signMessage(message);
          }

          case "eth_signTypedData_v4": {
            const [, typedDataJson] = args.params as [string, string];
            const typedData =
              typeof typedDataJson === "string" ? JSON.parse(typedDataJson) : typedDataJson;
            return this.signTypedData(typedData);
          }

          default:
            return this.getPublicClient().request(args as any);
        }
      },
    };
  }

  /**
   * Sign a raw hash.
   *
   * @param hash - The hash to sign.
   * @returns The signed hash.
   */
  abstract sign(hash: `0x${string}`): Promise<`0x${string}`>;

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
  abstract readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>>;

  /**
   * Get the underlying Viem PublicClient for read-only blockchain operations.
   */
  abstract getPublicClient(): PublicClient;
}
