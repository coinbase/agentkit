/**
 * Read Lite endpoint. A single x402-gated POST on Base.
 */
export const READ_LITE_URL = "https://x402-web-reader.vercel.app/api/read-lite";

/**
 * Origin whitelisted for x402 payments. Payments are only ever made to
 * READ_LITE_URL, never to a caller-supplied URL. (The URL being *read*
 * is caller-supplied; the URL being *paid* is not.)
 */
export const READ_LITE_ORIGIN = "https://x402-web-reader.vercel.app";

/**
 * Fixed price of one read: $0.005, in atomic USDC (6 decimals).
 */
export const READ_LITE_PRICE_USDC = 0.005;
export const READ_LITE_PRICE_ATOMIC = "5000";

/**
 * The only payment recipient the endpoint may ask for.
 */
export const READ_LITE_PAY_TO = "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1";

/**
 * Base mainnet, in both AgentKit and CAIP-2 spellings.
 */
export const READ_LITE_NETWORK_ID = "base-mainnet";
export const READ_LITE_CAIP2 = "eip155:8453";

/**
 * Cap on the markdown returned to the agent, so one huge page cannot
 * flood the agent's context. The endpoint's wordCount still reports
 * the full page size when the markdown is truncated.
 */
export const READ_LITE_MAX_MARKDOWN_CHARS = 32000;
