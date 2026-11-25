/**
 * Base URL of SBOR's public API. No key, no registration.
 */
export const SBOR_BASE_URL = "https://sbor.xyz";

/**
 * The current fixing, republished once a day.
 */
export const SBOR_LATEST_URL = `${SBOR_BASE_URL}/api/v1/latest.json`;

/**
 * A verdict an agent may act on must not rest on data older than this.
 */
export const STALE_AFTER_HOURS = 48;

/**
 * SBOR's default: stop and ask a human before borrowing more than this many
 * basis points above the benchmark.
 */
export const STOP_THRESHOLD_BPS = 50;

/**
 * The SBOR indices, one per currency on Stacks.
 */
export const SBOR_INDICES = ["SBOR-USD", "SBOR-BTC", "SBOR-STX"] as const;

/**
 * The cost of borrowing USDC against bitcoin wrapped by a custodian (cbBTC,
 * WBTC), from the Morpho markets on Base and Ethereum whose only collateral is
 * that bitcoin. A reference, not an SBOR index.
 */
export const BTC_COLLATERAL_USDC = "BTC-COLLATERAL-USDC";

/**
 * Every benchmark an offered rate can be compared against.
 */
export const SBOR_BENCHMARKS = [...SBOR_INDICES, BTC_COLLATERAL_USDC] as const;
