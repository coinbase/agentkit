import { WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";

/**
 * Schema for wallet data
 */
export const WalletDataSchema = z.object({
  walletId: z.string().describe("Unique identifier for the wallet"),
  chainId: z
    .string()
    .optional()
    .describe("Chain ID for EVM networks (e.g., '84532' for base-sepolia)"),
  networkId: z
    .string()
    .optional()
    .describe("Network ID for non-EVM networks (e.g., 'solana-devnet')"),
});

/**
 * Schema for wallet provider configuration
 */
export const WalletProviderConfigSchema = z
  .object({
    walletDataFilePath: z.string().describe("Path to the file where wallet data will be stored"),
    walletDefaultChainId: z
      .string()
      .optional()
      .describe("Default chain ID to use for EVM networks when no saved wallet exists"),
    walletDefaultNetworkId: z
      .string()
      .optional()
      .describe("Default network ID to use for non-EVM networks when no saved wallet exists"),
  })
  .describe("Configuration for wallet provider initialization");

// Infer types from schemas
export type WalletData = z.infer<typeof WalletDataSchema>;
export type WalletProviderConfig = z.infer<typeof WalletProviderConfigSchema>;

/**
 * Interface for wallet provider factories
 *
 * @template TConfig - Type of the configuration, must extend WalletProviderConfig
 * @template TProvider - Type of the wallet provider, must extend WalletProvider
 */
export interface WalletProviderFactory<
  TConfig extends WalletProviderConfig = WalletProviderConfig,
  TProvider extends WalletProvider = WalletProvider,
> {
  /**
   * Gets the required environment variables for this wallet provider
   */
  getRequiredEnv(): string[];

  /**
   * Creates a wallet provider instance
   *
   * @param config - Configuration for the wallet provider
   */
  createWalletProvider(config: TConfig): Promise<TProvider>;
}
