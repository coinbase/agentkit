/**
 * Default SelfPaidPal API endpoint on Base Mainnet (Chain ID 8453).
 */
export const DEFAULT_SELFPAID_API_URL = "https://selfpaid.cryptofolio.it";

/**
 * Supported DeFi yield protocols on Base Mainnet.
 */
export const SELFPAID_PROTOCOLS = ["auto", "aave", "morpho"] as const;

/**
 * Supported redeem protocols on Base Mainnet.
 */
export const SELFPAID_REDEEM_PROTOCOLS = ["aave", "morpho"] as const;

/**
 * Networks supported by SelfPaidActionProvider.
 */
export const SUPPORTED_NETWORKS = ["base-mainnet"] as const;
