import { PrivyWalletConfig } from "@coinbase/agentkit";
import fs from "fs";

export const WALLET_DATA_FILE = "wallet_data.txt";
export const DEFAULT_CHAIN_ID = "84532"; // base-sepolia

export interface SavedWalletData {
  walletId: string;
  chainId: string;
  networkId?: string;
}

export function loadSavedWalletData(): SavedWalletData | null {
  try {
    if (fs.existsSync(WALLET_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8"));
    }
  } catch {
    // Fail silently
  }
  return null;
}

export function saveWalletData(walletData: any): void {
  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(walletData));
}

function getBaseConfig(savedWallet: SavedWalletData | null) {
  const walletId = savedWallet?.walletId || process.env.PRIVY_WALLET_ID as string;

  return {
    appId: process.env.PRIVY_APP_ID as string,
    appSecret: process.env.PRIVY_APP_SECRET as string,
    authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
    authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
    walletId,
  };
}

export function createEthereumConfig(savedWallet: SavedWalletData | null): PrivyWalletConfig {
  const chainId = savedWallet?.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID;

  if (!process.env.CHAIN_ID && !savedWallet?.chainId) {
    console.warn("Warning: CHAIN_ID not set, defaulting to 'base-sepolia'");
  }

  return {
    ...getBaseConfig(savedWallet),
    chainId,
    chainType: "ethereum",
  };
}

export function createSolanaConfig(networkId: string, savedWallet: SavedWalletData | null): PrivyWalletConfig {
  return {
    ...getBaseConfig(savedWallet),
    chainType: "solana",
    networkId: savedWallet?.networkId || networkId,
    chainId: savedWallet?.chainId,
  };
} 