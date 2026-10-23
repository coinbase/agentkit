/**
 * Token Risk Check x402 endpoint (pays $0.01 in USDC on Base per check).
 */
export const TOKEN_SAFETY_ENDPOINT = "https://ca-tax-api-mainnet.lxtap.workers.dev/token";

/**
 * Chains the endpoint can check tokens on.
 */
export const TOKEN_SAFETY_CHAINS = [
  "base",
  "eth",
  "arbitrum",
  "optimism",
  "polygon",
  "solana",
] as const;

/**
 * Default per-check spending cap in USDC.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 0.05;

/**
 * Networks the paying wallet can be on (the endpoint is paid on Base).
 */
export const SUPPORTED_NETWORKS = ["base-mainnet"] as const;
