import { WalletProvider } from "@coinbase/agentkit";
import fs from "fs";

/**
 * Generic wallet data interface
 */
export interface WalletData {
  walletId: string;
  chainId?: string;
  networkId?: string;
}

/**
 * Generic wallet provider configuration
 */
export interface WalletProviderConfig {
  walletDataFilePath: string;
  walletDefaultChainId: string;
}

/**
 * Interface for wallet provider factories
 */
export interface WalletProviderFactory {
  createWalletProvider(config: WalletProviderConfig): Promise<WalletProvider>;
}

/**
 * Loads saved wallet data from the filesystem
 *
 * @param walletDataFilePath - Path to the wallet data file
 * @returns The saved wallet data, or null if no data exists or there was an error reading the file
 */
export function loadSavedWalletData(walletDataFilePath: string): WalletData | null {
  try {
    if (fs.existsSync(walletDataFilePath)) {
      return JSON.parse(fs.readFileSync(walletDataFilePath, "utf8"));
    }
  } catch {
    // fail silently for reads since this is expected when no wallet exists
  }
  return null;
}

/**
 * Saves wallet data to the filesystem
 *
 * @param walletDataFilePath - Path to the wallet data file
 * @param walletData - The wallet data to save
 * @throws {Error} If there was an error writing the file
 */
export function saveWalletData(walletDataFilePath: string, walletData: WalletData): void {
  const jsonData = JSON.stringify(walletData, null, 2);
  try {
    fs.writeFileSync(walletDataFilePath, jsonData);
  } catch (error) {
    console.error("Failed to save wallet data:", jsonData);
    throw new Error(
      `Failed to save wallet data (${jsonData}): ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
