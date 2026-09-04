/**
 * Constants for the RelayShield action provider.
 */

/**
 * Base URL of the RelayShield API.
 *
 * The pay-as-you-go routes under `/v1/payg/` answer with an HTTP 402 challenge
 * and settle in USDC, so an agent wallet can pay for a call directly without
 * an account or an API key.
 */
export const RELAYSHIELD_API_BASE = "https://api.relayshield.net";

/**
 * Networks RelayShield accepts x402 payment on.
 *
 * The screening itself covers many more chains than this. These are only the
 * networks a payment can settle on, which is what determines whether an agent
 * wallet can use the provider at all.
 */
export const SUPPORTED_NETWORKS = ["base-mainnet", "solana-mainnet"] as const;

/**
 * Endpoint paths used by this provider, with their per-call price in USDC.
 * Prices are informational, shown in the action descriptions. The authoritative
 * price always comes from the 402 challenge at call time.
 */
export const ENDPOINTS = {
  walletRisk: { path: "/v1/payg/wallet-risk", priceUsd: 0.05 },
  tokenSecurity: { path: "/v1/payg/token-security", priceUsd: 0.05 },
  nftSecurity: { path: "/v1/payg/nft-security", priceUsd: 0.1 },
  scanUrl: { path: "/v1/payg/scan-url", priceUsd: 0.05 },
} as const;
