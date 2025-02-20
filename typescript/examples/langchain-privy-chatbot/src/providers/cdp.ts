import { CdpWalletProvider } from "@coinbase/agentkit";
import { WalletProviderFactory, WalletProviderConfig } from "../types";
import { loadSavedWalletData, saveWalletData } from "../storage";
import { envIsRequired } from "../env";

interface CdpConfig extends WalletProviderConfig {
  apiKeyName?: string;
  apiKeyPrivateKey?: string;
}

type ValidatedConfig = CdpConfig & { apiKeyName: string; apiKeyPrivateKey: string };

/**
 * Validates the CDP configuration and ensures required fields are present
 *
 * @param config - The CDP configuration object to validate
 * @returns The validated configuration with all required fields
 */
function validateConfig(config: CdpConfig): ValidatedConfig {
  config.apiKeyName ||= process.env.CDP_API_KEY_NAME;
  config.apiKeyPrivateKey ||= process.env.CDP_API_KEY_PRIVATE_KEY;

  if (!config.apiKeyName) envIsRequired("CDP_API_KEY_NAME");
  if (!config.apiKeyPrivateKey) envIsRequired("CDP_API_KEY_PRIVATE_KEY");

  return config as ValidatedConfig;
}

/**
 * CDP wallet provider factory implementation for creating and managing CDP wallets
 */
export class CdpWalletProviderFactory implements WalletProviderFactory<CdpConfig> {
  /**
   * Returns the list of required environment variables for the CDP wallet provider
   *
   * @returns Array of required environment variable names
   */
  getRequiredEnv() {
    return ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  }

  /**
   * Creates a new CDP wallet provider instance with the given configuration
   *
   * @param config - Configuration object for the CDP wallet provider
   * @returns A configured CDP wallet provider instance
   */
  async createWalletProvider(config: CdpConfig) {
    const validatedConfig = validateConfig(config);
    const savedWallet = loadSavedWalletData(validatedConfig.walletDataFilePath);

    const networkId =
      savedWallet?.networkId || process.env.NETWORK_ID || validatedConfig.walletDefaultNetworkId;
    const walletData = savedWallet?.walletId ? JSON.stringify(savedWallet) : undefined;

    const cdpConfig = {
      apiKeyName: validatedConfig.apiKeyName,
      apiKeyPrivateKey: validatedConfig.apiKeyPrivateKey,
      cdpWalletData: walletData,
      networkId,
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(cdpConfig);
    const exportedWallet = await walletProvider.exportWallet();

    if (savedWallet?.walletId && savedWallet.walletId !== exportedWallet.walletId) {
      throw new Error(
        `Wallet ID mismatch. Expected ${savedWallet.walletId} but got ${exportedWallet.walletId}`,
      );
    }

    if (!savedWallet?.walletId && exportedWallet.walletId) {
      saveWalletData(validatedConfig.walletDataFilePath, {
        walletId: exportedWallet.walletId,
        networkId: exportedWallet.networkId || validatedConfig.walletDefaultNetworkId,
      });
    }

    return walletProvider;
  }
}
