/**
 * Default Stablecoin Gateways API origin. No API key is required; calls pay over x402 v2.
 */
export const STABLECOIN_GATEWAYS_DEFAULT_BASE_URL = "https://api.stablecoingateways.com";

/**
 * Default maximum USDC, in whole units, that one call may spend.
 * Quotes above this cap are refused before the wallet signs.
 */
export const STABLECOIN_GATEWAYS_DEFAULT_MAX_PAYMENT_USDC = 0.05;

/**
 * Published price for `screen_crypto_address`, in whole USDC.
 */
export const SCREEN_CRYPTO_ADDRESS_PRICE_USDC = 0.002;

/**
 * Published price for `counterparty_check` and `merchant_check`, in whole USDC.
 */
export const BUSINESS_CHECK_PRICE_USDC = 0.01;

/**
 * OFAC digital-currency-address lookup.
 */
export const SCREEN_CRYPTO_ADDRESS_PATH = "/v1/sanctions/address";

/**
 * One-call KYB preflight for a business counterparty.
 */
export const COUNTERPARTY_CHECK_PATH = "/v1/counterparty-check";

/**
 * Neutral merchant facts (domain, sanctions, LEI, SEC).
 */
export const MERCHANT_CHECK_PATH = "/v1/merchant-check";

/**
 * Required wording for every action description.
 */
export const NEUTRAL_FACTS_DISCLAIMER =
  "Results are neutral sourced facts, not a compliance determination; individuals are not screened.";
