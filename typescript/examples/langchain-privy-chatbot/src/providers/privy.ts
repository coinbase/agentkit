import {
  PrivyWalletProvider,
  PrivyEvmWalletProvider,
  PrivySvmWalletProvider,
  PrivyWalletExport,
  PrivyWalletConfig,
} from "@coinbase/agentkit";
import { WalletProviderFactory, WalletProviderConfig } from "../types";
import { loadSavedWalletData, saveWalletData } from "../storage";
import { envIsRequired } from "../env";

interface PrivyConfig extends WalletProviderConfig {
  appId?: string;
  appSecret?: string;
  authorizationKeyId?: string;
  authorizationPrivateKey?: string;
}

type ValidatedConfig = PrivyConfig & { appId: string; appSecret: string };

/**
 * Validates the Privy configuration and ensures required fields are present
 *
 * @param config - The Privy configuration object to validate
 * @returns The validated configuration with all required fields
 */
function validateConfig(config: PrivyConfig): ValidatedConfig {
  config.appId ||= process.env.PRIVY_APP_ID;
  config.appSecret ||= process.env.PRIVY_APP_SECRET;
  config.authorizationKeyId ||= process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID;
  config.authorizationPrivateKey ||= process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY;

  if (!config.appId) envIsRequired("PRIVY_APP_ID");
  if (!config.appSecret) envIsRequired("PRIVY_APP_SECRET");

  return config as ValidatedConfig;
}

/**
 * Gets the base configuration for a Privy wallet
 *
 * @param savedWallet - Previously saved wallet data
 * @param config - Current Privy configuration
 * @returns Base configuration for Privy wallet
 */
function getPrivyBaseConfig(savedWallet: PrivyWalletExport | null, config: ValidatedConfig) {
  const walletId = savedWallet?.walletId || process.env.PRIVY_WALLET_ID;
  return {
    appId: config.appId,
    appSecret: config.appSecret,
    authorizationKeyId: config.authorizationKeyId,
    authorizationPrivateKey: config.authorizationPrivateKey,
    walletId,
  };
}

/**
 * Creates configuration for a Privy Ethereum wallet
 *
 * @param savedWallet - Previously saved wallet data
 * @param config - Current Privy configuration
 * @returns Configuration for Privy Ethereum wallet
 */
function createPrivyEthereumConfig(
  savedWallet: PrivyWalletExport | null,
  config: ValidatedConfig,
): PrivyWalletConfig {
  const chainId = savedWallet?.chainId || process.env.CHAIN_ID || config.walletDefaultChainId;
  if (!chainId) throw new Error("No chain ID available for Ethereum wallet");

  return {
    ...getPrivyBaseConfig(savedWallet, config),
    chainType: "ethereum",
    chainId,
  };
}

/**
 * Creates configuration for a Privy Solana wallet
 *
 * @param networkId - The network ID to use
 * @param savedWallet - Previously saved wallet data
 * @param config - Current Privy configuration
 * @returns Configuration for Privy Solana wallet
 */
function createPrivySolanaConfig(
  networkId: string,
  savedWallet: PrivyWalletExport | null,
  config: ValidatedConfig,
): PrivyWalletConfig {
  return {
    ...getPrivyBaseConfig(savedWallet, config),
    chainType: "solana",
    networkId: savedWallet?.networkId || networkId,
    chainId: savedWallet?.chainId,
  };
}

/**
 * Privy wallet provider factory implementation for creating and managing Privy wallets
 */
export class PrivyWalletProviderFactory
  implements WalletProviderFactory<PrivyConfig, PrivyEvmWalletProvider | PrivySvmWalletProvider>
{
  /**
   * Returns the list of required environment variables for the Privy wallet provider
   *
   * @returns Array of required environment variable names
   */
  getRequiredEnv() {
    return ["PRIVY_APP_ID", "PRIVY_APP_SECRET"];
  }

  /**
   * Creates a new Privy wallet provider instance with the given configuration
   *
   * @param config - Configuration object for the Privy wallet provider
   * @returns A configured Privy wallet provider instance
   */
  async createWalletProvider(
    config: PrivyConfig,
  ): Promise<PrivyEvmWalletProvider | PrivySvmWalletProvider> {
    const validatedPrivyConfig = validateConfig(config);
    const savedWallet = loadSavedWalletData(
      validatedPrivyConfig.walletDataFilePath,
    ) as PrivyWalletExport;

    // savedWallet.networkId > env.NETWORK_ID > default
    const effectiveNetworkId =
      savedWallet?.networkId ||
      process.env.NETWORK_ID ||
      validatedPrivyConfig.walletDefaultNetworkId;
    const isSolana = effectiveNetworkId?.includes("solana");

    if (!effectiveNetworkId && !validatedPrivyConfig.walletDefaultChainId) {
      throw new Error("No network ID or chain ID available");
    }

    const walletConfig = isSolana
      ? createPrivySolanaConfig(effectiveNetworkId!, savedWallet, validatedPrivyConfig)
      : createPrivyEthereumConfig(savedWallet, validatedPrivyConfig);

    const walletProvider = await PrivyWalletProvider.configureWithWallet(walletConfig);
    const exportedWallet = walletProvider.exportWallet();

    if (savedWallet && savedWallet.walletId !== exportedWallet.walletId) {
      throw new Error(
        `Wallet ID mismatch. Expected ${savedWallet.walletId} but got ${exportedWallet.walletId}`,
      );
    }

    if (!savedWallet) {
      saveWalletData(validatedPrivyConfig.walletDataFilePath, exportedWallet);
    }

    return walletProvider;
  }
}
