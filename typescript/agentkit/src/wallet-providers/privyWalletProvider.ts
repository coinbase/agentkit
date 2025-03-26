import { PrivyEvmWalletProvider, PrivyEvmWalletConfig } from "./privyEvmWalletProvider";
import { PrivySvmWalletProvider, PrivySvmWalletConfig } from "./privySvmWalletProvider";
import {
  PrivyEvmDelegatedEmbeddedWalletProvider,
  PrivyEvmDelegatedEmbeddedWalletConfig,
} from "./privyEvmDelegatedEmbeddedWalletProvider";

export type PrivyWalletConfig =
  | PrivyEvmWalletConfig
  | PrivySvmWalletConfig
  | PrivyEvmDelegatedEmbeddedWalletConfig;

export type PrivyWalletProviderVariant<T> = T extends { walletType: "embedded" }
  ? PrivyEvmDelegatedEmbeddedWalletProvider
  : T extends { chainType: "solana" }
    ? PrivySvmWalletProvider
    : PrivyEvmWalletProvider;

/**
 * Factory class for creating chain-specific Privy wallet providers
 */
export class PrivyWalletProvider {
  /**
   * Creates and configures a new wallet provider instance based on the chain type and wallet type.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured WalletProvider instance for the specified chain and wallet type
   *
   * @example
   * ```typescript
   *  For EVM server wallets (default)
   * const evmWallet = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret"
   * });
   *
   * For Solana
   * const solanaWallet = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   chainType: "solana"
   * });
   *
   * For Embedded Wallet
   * const embeddedWallet = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   walletId: "delegated-wallet-id",
   *   walletType: "embedded"
   * });
   * ```
   */
  static async configureWithWallet<T extends PrivyWalletConfig>(
    config: T & {
      chainType?: "ethereum" | "solana";
      walletType?: "server" | "embedded";
    },
  ): Promise<PrivyWalletProviderVariant<T>> {
    // Check for embedded wallet first
    if (config.walletType === "embedded") {
      return (await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(
        config as PrivyEvmDelegatedEmbeddedWalletConfig,
      )) as PrivyWalletProviderVariant<T>;
    }

    // Then check for chain type
    if (config.chainType === "solana") {
      return (await PrivySvmWalletProvider.configureWithWallet(
        config as PrivySvmWalletConfig,
      )) as PrivyWalletProviderVariant<T>;
    }

    // Default to EVM server wallet
    return (await PrivyEvmWalletProvider.configureWithWallet(
      config as PrivyEvmWalletConfig,
    )) as PrivyWalletProviderVariant<T>;
  }
}
