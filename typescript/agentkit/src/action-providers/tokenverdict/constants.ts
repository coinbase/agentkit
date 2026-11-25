/**
 * Token Verdict endpoint. A single x402-gated POST on Base.
 */
export const TOKEN_VERDICT_URL = "https://crypto-intel-agent.vercel.app/api/token-verdict";

/**
 * Origin whitelisted for x402 payments. Payments are only ever made to
 * TOKEN_VERDICT_URL, never to a caller-supplied URL.
 */
export const TOKEN_VERDICT_ORIGIN = "https://crypto-intel-agent.vercel.app";

/**
 * Fixed price of one check: $0.02, in atomic USDC (6 decimals).
 */
export const TOKEN_VERDICT_PRICE_USDC = 0.02;
export const TOKEN_VERDICT_PRICE_ATOMIC = "20000";

/**
 * The only payment recipient the endpoint may ask for.
 */
export const TOKEN_VERDICT_PAY_TO = "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1";

/**
 * Base mainnet, in both AgentKit and CAIP-2 spellings.
 */
export const TOKEN_VERDICT_NETWORK_ID = "base-mainnet";
export const TOKEN_VERDICT_CAIP2 = "eip155:8453";
