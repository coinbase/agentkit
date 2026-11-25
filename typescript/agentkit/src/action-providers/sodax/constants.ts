/**
 * Base URL of the SODAX Swaps HTTP API.
 *
 * @see https://docs.sodax.com/developers/http-api/swaps
 */
export const SODAX_SWAPS_API_URL = "https://api.sodax.com/v1/swaps";

/**
 * Maps EVM chain IDs to the SODAX chain keys the Swaps API expects.
 *
 * These are the EVM networks SODAX supports as swap sources. Hedera (chain ID 295) is
 * deliberately left out: its JSON-RPC relay scales native values differently from other
 * EVM chains, so it needs dedicated handling.
 */
export const SODAX_EVM_CHAIN_KEYS: Record<number, string> = {
  1: "ethereum",
  10: "0xa.optimism",
  56: "0x38.bsc",
  137: "0x89.polygon",
  146: "sonic",
  151: "redbelly",
  999: "hyper",
  1890: "lightlink",
  4663: "robinhood",
  8217: "0x2019.kaia",
  8453: "0x2105.base",
  42161: "0xa4b1.arbitrum",
  43114: "0xa86a.avax",
};

/**
 * SODAX chain keys of EVM networks. Destinations on these chains default to the wallet address.
 */
export const SODAX_EVM_CHAIN_KEY_SET = new Set<string>([
  ...Object.values(SODAX_EVM_CHAIN_KEYS),
  "hedera",
]);

/**
 * Address the SODAX API uses for a chain's native asset on EVM networks.
 */
export const SODAX_NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Solver address meaning "any solver may fill this intent". It happens to equal the native
 * token address, but the two are unrelated sentinels.
 */
export const SODAX_ANY_SOLVER = "0x0000000000000000000000000000000000000000";

/**
 * Default maximum slippage in basis points (100 = 1%).
 */
export const DEFAULT_SLIPPAGE_BPS = 100;

/**
 * Seconds from now (hub time) until a swap intent expires.
 */
export const DEFAULT_DEADLINE_OFFSET_SECONDS = 300;

/**
 * Timeout for a single SODAX API request.
 */
export const SODAX_REQUEST_TIMEOUT_MS = 20_000;
