/**
 * Default base URL of the Agentic Finance Graph public API.
 */
export const AGENTIC_FINANCE_GRAPH_API_URL = "https://agenticfinancegraph.com";

/**
 * Default timeout for a single API request, in milliseconds.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The chain whose agents and payments the ledger measures in full (CAIP-2).
 */
export const BASE_MAINNET = "eip155:8453";

/**
 * Decimals of the USDC base units used in agent statements.
 */
export const USDC_DECIMALS = 6;

/**
 * Maximum number of recent detections returned with an agent check.
 */
export const MAX_AGENT_DETECTIONS = 5;

/**
 * Maximum length of any text field passed through to the model.
 */
export const MAX_TEXT_LENGTH = 200;

/**
 * Meaning of each public liveness level. The public rank starts at L7: a level is earned by
 * observed payments, never by registration or self-declaration.
 */
export const LIVENESS_LEVELS: Readonly<Record<number, string>> = {
  7: "A wallet bound to this registration was observed paying a different address after the agent was registered.",
  8: "L7, and the paying wallet still holds at least $10 in stablecoins.",
  9: "L8, and it paid three or more distinct counterparties in the last 30 days.",
};

/**
 * Headline figures returned by get_agent_economy_overview, in display order.
 */
export const OVERVIEW_FIGURES = [
  "registrations_minted_total",
  "actors_l7_plus",
  "actors_l8_plus",
  "actors_l9",
  "observed_pay_usd_total",
  "observed_pay_usd_own_positions",
  "observed_pay_usd_left_control",
  "pass_through_pay_usd_excluded",
  "pay_usd_last_day",
  "pay_usd_7d_avg",
  "observed_pay_usd_median",
  "detections_7d",
  "live_incidents",
  "poison_wallets_targeted_7d",
] as const;
