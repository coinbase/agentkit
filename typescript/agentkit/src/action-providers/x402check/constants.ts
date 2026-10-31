/**
 * Default origin for the x402check trust-preflight API.
 * Override with X402CHECK_URL or config.baseUrl.
 */
export const DEFAULT_X402CHECK_BASE_URL = "https://x402check.dev";

/**
 * Env var for the x402check origin (no trailing slash).
 */
export const X402CHECK_URL_ENV = "X402CHECK_URL";

/**
 * Env kill-switch — when "1", preflight returns a synthetic ok verdict (tests / local).
 */
export const X402CHECK_SKIP_ENV = "X402CHECK_SKIP";
