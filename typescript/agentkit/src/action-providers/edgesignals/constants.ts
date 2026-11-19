/**
 * Base URL for the Edge Signals API.
 */
export const SIGNALS_BASE_URL = "https://signals.edge.report";

/**
 * Path for the Token Verdict endpoint.
 */
export const TOKEN_VERDICT_PATH = "/v1/token-verdict";

/**
 * Advertised price of one Token Verdict call, in USDC on Base, paid via x402.
 */
export const TOKEN_VERDICT_PRICE_USDC = "0.01";

/**
 * Default chain for Token Verdict when the caller does not specify one.
 */
export const DEFAULT_TOKEN_CHAIN = "base";
