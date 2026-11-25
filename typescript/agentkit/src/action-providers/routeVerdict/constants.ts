/**
 * Production RouteVerdict service.
 */
export const ROUTE_VERDICT_BASE_URL = "https://route-verdict-production.up.railway.app";

/**
 * The paid route, and its price: $0.05 USDC per call on Base.
 */
export const ROUTE_VERDICT_PATH = "/v1/check";
export const ROUTE_VERDICT_PRICE = "$0.05";

/**
 * Payments settle in USDC on Base mainnet (CAIP-2).
 */
export const BASE_NETWORK = "eip155:8453" as const;

/**
 * USDC contract on Base mainnet — the only asset RouteVerdict accepts.
 */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * USDC has 6 decimals; the spend guard converts dollar amounts to
 * atomic units with this.
 */
export const USDC_DECIMALS = 6;
