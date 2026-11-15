/**
 * Default base URL of the Trading Signals Toolkit API.
 */
export const TRADING_SIGNALS_BASE_URL = "https://signals.incomefather.com";

/**
 * Default per-call payment cap in USDC. The most expensive route in this provider costs 0.02 USDC.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 0.05;

/**
 * Networks the agent's wallet can pay from (x402 `exact` scheme, USDC on mainnet).
 */
export const SUPPORTED_PAYMENT_NETWORKS = ["base-mainnet", "solana-mainnet"] as const;

/**
 * CAIP-2 network identifiers accepted by the API, keyed by AgentKit network ID.
 */
export const CAIP2_BY_NETWORK_ID: Record<string, string> = {
  "base-mainnet": "eip155:8453",
  "solana-mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

/**
 * USDC mint / contract address per CAIP-2 network (lowercased for EVM comparison).
 */
export const USDC_BY_CAIP2: Record<string, string> = {
  "eip155:8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

/**
 * Paid routes used by this provider, with their list price in USD.
 */
export const ROUTES = {
  baseTokenVerdict: { path: "/base/token-verdict", priceUsd: 0.01 },
  solanaTokenVerdict: { path: "/solana/token-verdict", priceUsd: 0.01 },
  tokenPreTradePack: { path: "/bundle/token-pre-trade", priceUsd: 0.015 },
  whaleFlow: { path: "/crypto/whale-flow", priceUsd: 0.02 },
} as const;

export type TradingSignalsRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Request timeout in milliseconds. Whale flow and pre-trade checks can take several seconds.
 */
export const REQUEST_TIMEOUT_MS = 60_000;
