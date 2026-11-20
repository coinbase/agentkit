/**
 * Base URL for the x402 Bazaar API.
 */
export const API_BASE_URL = "https://402.com.tr/api/x402";

/**
 * token-verdict endpoint + token query param, per token chain. Every chain's
 * verdict settles in USDC on Base, so the EVM paid path covers all three.
 */
export const CHAIN_ENDPOINTS = {
  base: { endpoint: "token-verdict", param: "address" },
  arbitrum: { endpoint: "arb-token-verdict", param: "address" },
  solana: { endpoint: "sol-token-verdict", param: "mint" },
} as const;

/**
 * Base URL for the x402 Bazaar token-verdict endpoint (Base). Kept for back-compat.
 */
export const TOKEN_VERDICT_URL = `${API_BASE_URL}/token-verdict`;

/**
 * Agent wallet networks this provider activates on. Token screening itself works
 * for Base, Arbitrum and Solana tokens via the `chain` input regardless.
 */
export const SUPPORTED_NETWORKS = ["base-mainnet", "arbitrum-mainnet"] as const;

/**
 * USDC on Base — the asset the x402 challenge is priced in.
 */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
