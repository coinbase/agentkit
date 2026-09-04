/**
 * Base URL of the Beaver Knight bureau API. Public, unauthenticated, read-only.
 */
export const BEAVER_KNIGHT_BASE_URL = "https://www.beaverknight.com";

/**
 * The sort keys /api/vaults accepts.
 */
export const VAULT_SORT_KEYS = [
  "score",
  "return",
  "sharpe",
  "sortino",
  "calmar",
  "drawdown",
  "tvl",
  "decisions",
] as const;
