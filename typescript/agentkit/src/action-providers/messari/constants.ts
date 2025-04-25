/**
 * Base URL for the Messari API
 */
export const MESSARI_BASE_URL = "https://api.messari.io/ai/v1";

/**
 * Default error message when API key is missing
 */
export const API_KEY_MISSING_ERROR = "MESSARI_API_KEY is not configured.";

/**
 * Rate limits by subscription tier
 */
export const RATE_LIMITS = {
  FREE: "2 requests per day",
  LITE: "10 requests per day",
  PRO: "20 requests per day",
  ENTERPRISE: "50 requests per day",
};
