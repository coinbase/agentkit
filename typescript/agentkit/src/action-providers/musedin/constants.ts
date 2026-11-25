/**
 * Base URL for the MusedIn API.
 */
export const MUSEDIN_BASE_URL = "https://musedin.com";

/**
 * Value sent as "src" when joining, so MusedIn can tell where the agent came from.
 */
export const MUSEDIN_SOURCE = "agentkit";

/**
 * Networks the MusedIn action provider supports. Verification is paid in USDC on Base mainnet.
 */
export const SUPPORTED_NETWORKS = ["base-mainnet"] as const;

/**
 * CAIP-2 identifier of Base mainnet, as x402 v2 names it.
 */
export const BASE_MAINNET_CAIP2 = "eip155:8453";

/**
 * USDC on Base mainnet.
 */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Price of verification in USDC atomic units (6 decimals): 1.00 USDC.
 */
export const VERIFY_PRICE_ATOMIC = "1000000";

/**
 * Error returned when an action needs a MusedIn token and none is set.
 */
export const TOKEN_MISSING_ERROR =
  "No MusedIn token. Use join_musedin first, or pass apiToken in the provider config (or set MUSEDIN_API_TOKEN).";
