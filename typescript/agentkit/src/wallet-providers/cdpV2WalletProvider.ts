import { CdpV2EvmWalletProvider } from "./cdpV2EvmWalletProvider";
import { CdpV2SolanaWalletProvider } from "./cdpV2SolanaWalletProvider";
import { CdpV2WalletProviderConfig } from "./cdpV2Shared"
import { SOLANA_NETWORK_ID, SOLANA_NETWORK_IDS } from "../network";

export type CdpV2WalletProviderVariant = CdpV2SolanaWalletProvider | CdpV2EvmWalletProvider;

/**
 * Factory class for creating chain-specific CDP V2 wallet providers
 */
export class CdpV2WalletProvider {
  /**
   * Creates and configures a new wallet provider instance based on the chain type.
   *
   * @param config - The configuration options for the CdpV2 wallet
   * @returns A configured WalletProvider instance for the specified chain
   *
   * @example
   * ```typescript
   * // For EVM server wallets (default)
   * const evmWallet = await CdpV2WalletProvider.configureWithWallet({
   *   apiKeyId: "your-api-key-id",
   *   apiKeySecret: "your-api-key-secret",
   *   walletSecret: "your-wallet-secret",
   *   networkId: "base-sepolia" // or any EVM network. Defaults to "base-sepolia"
   * });
   *
   * // For Solana server wallets
   * const solanaWallet = await CdpV2WalletProvider.configureWithWallet({
   *   apiKeyId: "your-api-key-id",
   *   apiKeySecret: "your-api-key-secret",
   *   walletSecret: "your-wallet-secret",
   *   networkId: "solana-devnet" // or "solana-mainnet"
   * });
   * ```
   */
  static async configureWithWallet<T extends CdpV2WalletProviderConfig>(
    config: T,
  ): Promise<CdpV2WalletProviderVariant> {
    const useSolana = config.networkId && SOLANA_NETWORK_IDS.includes(config.networkId as SOLANA_NETWORK_ID);

    const walletProviderClass = useSolana ? CdpV2SolanaWalletProvider : CdpV2EvmWalletProvider;

    return await walletProviderClass.configureWithWallet(config);
  }
}
