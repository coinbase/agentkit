/**
 * Deal Verdict endpoint. A single x402-gated POST on Base.
 * Verified live (unpaid) 2026-11-25: HTTP 402, accepts[0] = $0.01
 * (10000 atomic USDC), network eip155:8453, USDC asset, known payTo.
 */
export const DEAL_VERDICT_URL = "https://x402-web-reader.vercel.app/api/deal-verdict";

/**
 * Origin whitelisted for x402 payments. Payments are only ever made to
 * DEAL_VERDICT_URL, never to a caller-supplied URL.
 */
export const DEAL_VERDICT_ORIGIN = "https://x402-web-reader.vercel.app";

/**
 * Fixed price of one check: $0.01, in atomic USDC (6 decimals).
 */
export const DEAL_VERDICT_PRICE_USDC = 0.01;
export const DEAL_VERDICT_PRICE_ATOMIC = "10000";

/**
 * The only payment recipient the endpoint may ask for.
 */
export const DEAL_VERDICT_PAY_TO = "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1";

/**
 * Base mainnet, in both AgentKit and CAIP-2 spellings.
 */
export const DEAL_VERDICT_NETWORK_ID = "base-mainnet";
export const DEAL_VERDICT_CAIP2 = "eip155:8453";
