import { PrivyEvmWalletProvider, PrivyEvmWalletConfig } from "./privyEvmWalletProvider";

export type PrivyWalletConfig = PrivyEvmWalletConfig;

/**
 * Factory class for creating chain-specific Privy wallet providers
 */
export class PrivyWalletProvider {
  /**
   * Creates and configures a new wallet provider instance based on the chain type.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured WalletProvider instance for the specified chain
   *
   * @example
   * ```typescript
   * // For EVM (default)
   * const evmWallet = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret"
   * });
   * ```
   */
  static async configureWithWallet<T extends PrivyWalletConfig>(
    config: T & { chainType?: "ethereum" },
  ): Promise<PrivyEvmWalletProvider> {
    return (await PrivyEvmWalletProvider.configureWithWallet(
      config as PrivyEvmWalletConfig,
    )) as PrivyEvmWalletProvider;
  }
}
