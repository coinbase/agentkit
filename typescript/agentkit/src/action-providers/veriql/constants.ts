export const VERIQL_BASE_URL = "https://veriql.app";

/**
 * Veriql charges $0.005 per call. The default cap leaves room for a price
 * change without letting a misconfigured endpoint charge an agent real money:
 * any payment option above it is dropped before anything is signed.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 0.01;

/** USDC has 6 decimals on every network Veriql accepts (Base, Solana). */
export const USDC_DECIMALS = 6;

/**
 * The free denylist changes once a day; an hour keeps an agent from
 * re-downloading it on every lookup.
 */
export const DENYLIST_TTL_MS = 60 * 60 * 1000;
