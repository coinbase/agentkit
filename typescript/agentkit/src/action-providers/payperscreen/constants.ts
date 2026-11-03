/** Default PayPerScreen API base URL. */
export const PAYPERSCREEN_API_URL = "https://api.payperscreen.com";

/** Price of one paid check in USD. */
export const PAYPERSCREEN_CHECK_PRICE_USD = 0.02;

/** USDC contract per CAIP-2 network, so the agent only ever signs USDC payments. */
export const USDC_BY_NETWORK: Record<string, string> = {
  "eip155:8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base
  "eip155:137": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // Polygon
  "eip155:42161": "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Arbitrum
};

/** Reminder attached to every paid result. */
export const RESULT_NOTE =
  "Results are possible matches and signals for a person to review, not a legal determination. " +
  "The decision to onboard, pay or block stays with you and your policy.";
