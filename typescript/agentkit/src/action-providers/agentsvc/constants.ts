/**
 * Base URL of the agentsvc.io x402 services
 */
export const AGENTSVC_BASE_URL = "https://agentsvc.io/api/v1/proxy";

/**
 * Networks on which agentsvc.io accepts USDC (x402 network names used by AgentKit)
 */
export const SUPPORTED_NETWORKS = ["base-mainnet", "solana-mainnet"] as const;

/**
 * Default maximum payment per call in whole USDC. The checks cost between 0.003 and 0.009 USDC.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 0.05;

/**
 * Chains supported by the token risk check
 */
export const TOKEN_CHAINS = ["base", "ethereum", "bsc", "arbitrum", "polygon", "solana"] as const;
