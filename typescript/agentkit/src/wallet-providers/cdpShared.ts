import { CdpClient, type EvmServerAccount } from "@coinbase/cdp-sdk";
import type { Address, LocalAccount } from "viem";

export interface CdpProviderConfig {
  /**
   * The CDP API Key ID.
   */
  apiKeyId?: string;

  /**
   * The CDP API Key Secret.
   */
  apiKeySecret?: string;

  /**
   * The CDP Wallet Secret.
   */
  walletSecret?: string;
}

/**
 * Configuration options for the CDP Providers.
 */
export interface CdpWalletProviderConfig extends CdpProviderConfig {
  /**
   * The address of the wallet.
   */
  address?: Address;

  /**
   * The network of the wallet.
   */
  networkId?: string;

  /**
   * The idempotency key of the wallet. Only used when creating a new account.
   */
  idempotencyKey?: string;
}

export interface CdpSmartWalletProviderConfig extends CdpWalletProviderConfig {
  /**
   * The owner account of the smart wallet.
   */
  owner?: EvmServerAccount | LocalAccount | Address;

  /**
   * The name of the smart wallet.
   */
  smartAccountName?: string;
}

/**
 * A wallet provider that can be used to interact with the CDP.
 */
export interface WalletProviderWithClient {
  /**
   * Gets the CDP client.
   */
  getClient(): CdpClient;
}

/**
 * Type guard to check if a wallet provider implements WalletProviderWithClient interface.
 *
 * @param provider - The provider to check
 * @returns True if the provider implements WalletProviderWithClient
 */
export function isWalletProviderWithClient(
  provider: unknown,
): provider is WalletProviderWithClient {
  return (
    provider !== null &&
    typeof provider === "object" &&
    "getClient" in provider &&
    typeof (provider as WalletProviderWithClient).getClient === "function"
  );
}
