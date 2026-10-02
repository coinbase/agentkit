/**
 * Constants for the FlipCoin action provider.
 */

export const FLIPCOIN_API_BASE_URL = "https://www.flipcoin.fun";

export const FLIPCOIN_API_VERSION = "2026-03-19";

export const SUPPORTED_NETWORK_IDS = ["base-mainnet", "base-sepolia"] as const;

export const SUPPORTED_CHAIN_IDS = {
  "base-mainnet": 8453,
  "base-sepolia": 84532,
} as const;

/**
 * Default max slippage for LMSR trades (basis points).
 * Matches FlipCoin's documented default (100 = 1%).
 */
export const DEFAULT_MAX_SLIPPAGE_BPS = 100;

/**
 * Default max fee for LMSR trades (basis points).
 * Matches FlipCoin's documented default (200 = 2%).
 */
export const DEFAULT_MAX_FEE_BPS = 200;
