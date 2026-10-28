/**
 * Production StallRow service (the pre-trade stack's home stall).
 */
export const STALL_ROW_BASE_URL = "https://stall-row-production.up.railway.app";

/**
 * The paid routes, and their prices in USDC per call on Base.
 */
export const PRE_TRADE_GUARD_PATH = "/v1/pre-trade-guard";
export const PRE_TRADE_GUARD_PRICE = "$0.005";
export const COUNTERPARTY_REPORT_PATH = "/v1/counterparty-report";
export const COUNTERPARTY_REPORT_PRICE = "$1.00";
export const RECEIPT_VERIFY_PATH = "/v1/receipt-verify";
export const RECEIPT_VERIFY_PRICE = "$0.002";

/**
 * Payments settle in USDC on Base mainnet (CAIP-2).
 */
export const BASE_NETWORK = "eip155:8453" as const;

/**
 * USDC contract on Base mainnet — the only asset StallRow accepts.
 */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * USDC has 6 decimals; the spend guard converts dollar amounts to
 * atomic units with this.
 */
export const USDC_DECIMALS = 6;
