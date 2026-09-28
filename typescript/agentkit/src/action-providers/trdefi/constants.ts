/**
 * Base URL for the TRDEFI public read API
 */
export const TRDEFI_API_BASE_URL = "https://yield.trdefi.com";

/**
 * Chains supported by the TRDEFI strategies catalogue
 */
export const TRDEFI_SUPPORTED_CHAINS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
] as const;
