import { DynamicEvmWalletProvider, DynamicEvmWalletConfig } from "./dynamicEvmWalletProvider";
import { DynamicSvmWalletProvider, DynamicSvmWalletConfig } from "./dynamicSvmWalletProvider";

type DynamicWalletConfig = (
  | DynamicEvmWalletConfig
  | DynamicSvmWalletConfig
) & {
  chainType?: "ethereum" | "solana";
};

/**
 * Factory class for creating Dynamic wallet providers.
 * This class provides a unified interface for creating both EVM and SVM wallet providers.
 */
export class DynamicWalletProvider {
  /**
   * Creates and configures a new Dynamic wallet provider instance.
   *
   * @param config - The configuration options for the Dynamic wallet
   * @returns A configured Dynamic wallet provider instance
   *
   * @example
   * ```typescript
   * // Create an EVM wallet provider
   * const evmProvider = await DynamicWalletProvider.configureWithWallet({
   *   authToken: "your-auth-token",
   *   environmentId: "your-environment-id",
   *   baseApiUrl: "https://app.dynamicauth.com",
   *   baseMPCRelayApiUrl: "relay.dynamicauth.com",
   *   chainType: "ethereum",
   *   chainId: "84532"
   * });
   *
   * // Create an SVM wallet provider
   * const svmProvider = await DynamicWalletProvider.configureWithWallet({
   *   authToken: "your-auth-token",
   *   environmentId: "your-environment-id",
   *   baseApiUrl: "https://app.dynamicauth.com",
   *   baseMPCRelayApiUrl: "relay.dynamicauth.com",
   *   chainType: "solana",
   *   networkId: "mainnet-beta"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: DynamicWalletConfig,
  ): Promise<DynamicEvmWalletProvider | DynamicSvmWalletProvider> {
    const chainType = config.chainType || "ethereum";

    if (chainType === "ethereum") {
      return DynamicEvmWalletProvider.configureWithWallet(config as DynamicEvmWalletConfig);
    } else {
      return DynamicSvmWalletProvider.configureWithWallet(config as DynamicSvmWalletConfig);
    }
  }
} 