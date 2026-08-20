/**
 * Base URL for the QuantOracle API.
 *
 * Override via the QUANTORACLE_API_URL env var if you're proxying through a
 * private gateway or testing against a staging instance.
 */
export const QUANTORACLE_BASE_URL =
  process.env.QUANTORACLE_API_URL ?? "https://api.quantoracle.dev";

/**
 * Free tier daily limit per IP. Free tier covers calculator endpoints
 * (price_option, calculate_kelly, simulate_portfolio).
 */
export const FREE_TIER_DAILY_LIMIT = 1000;

/**
 * User-Agent for source attribution in QuantOracle's analytics dashboard.
 */
export const USER_AGENT = "QuantOracle-AgentKit/1.0";
