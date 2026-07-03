/**
 * Base URL for the Graph Advocate agent (routing + agent-priced trader intelligence).
 */
export const GRAPH_ADVOCATE_BASE_URL = "https://graphadvocate.com";

/**
 * Graph Advocate's x402-paid endpoints. Payments settle in USDC on Base.
 * `priceUsdc` is the published per-call price, used to enforce the
 * `maxPaymentUsdc` guard before a payment is ever signed.
 */
export const GRAPH_ADVOCATE_ENDPOINTS = {
  hyperliquid_trader_score: { path: "/hyperliquid/score", priceUsdc: 0.02 },
  polymarket_trader_score: { path: "/polymarket/pnl-quick", priceUsdc: 0.01 },
  agent_reputation: { path: "/agent/score", priceUsdc: 0.02 },
} as const;

export type GraphAdvocateEndpointKey = keyof typeof GRAPH_ADVOCATE_ENDPOINTS;

/**
 * Graph Advocate settles x402 payments in USDC on Base, so the provider only
 * supports Base mainnet.
 */
export const GRAPH_ADVOCATE_SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * Default per-call spend ceiling in whole USDC. Overridable via config or the
 * GRAPH_ADVOCATE_MAX_PAYMENT_USDC env var.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 1.0;
