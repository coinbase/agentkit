export const AGENTUM_BASE_URL = "https://agentum.asimplek.cloud";

/**
 * Highest price (USD) the agent may pay for a single call unless the integrator raises it.
 * Every Agentum action costs between $0.002 and $0.010 except batch_resolve ($0.025).
 */
export const AGENTUM_DEFAULT_MAX_PRICE_USD = 0.03;

export const AGENTUM_DEFAULT_TIMEOUT_MS = 30_000;

/** The Agentum server settles x402 payments in USDC on Base mainnet only. */
export const SUPPORTED_NETWORKS = ["base-mainnet"] as const;

/** USDC has 6 decimals. */
export const USDC_DECIMALS = 6;

export const AGENTUM_ENDPOINTS = {
  resolve_entity: "/v1/entity/resolve",
  verify_eu_vat: "/v1/entity/vat-verify",
  screen_sanctions: "/v1/entity/sanctions-screen",
  check_vendor: "/v1/compliance/check-vendor",
  verify_bank_payee: "/v1/compliance/verify-bank-payee",
  batch_resolve: "/v1/entity/batch-resolve",
  screen_address: "/v1/compliance/screen-address",
} as const;

export type AgentumActionName = keyof typeof AGENTUM_ENDPOINTS;
