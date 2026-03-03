/**
 * 1ly marketplace API base URL
 */
export const ONELY_API_BASE = "https://1ly.store";

/**
 * Supported networks for 1ly marketplace
 * Supports Base (EVM) and Solana mainnet only for x402 payments
 */
export const SUPPORTED_NETWORKS = [
  "base-mainnet",
  "solana-mainnet",
] as const;
