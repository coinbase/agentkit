/**
 * Base URL for the TaskMarket public API.
 *
 * The discovery endpoints used by this action provider are unauthenticated and
 * read-only, so no API key or wallet is required to browse work.
 */
export const TASKMARKET_BASE_URL = "https://api.taskmarket.dev/api";

/**
 * Human-facing task pages, used to give the agent a link it can hand back to a
 * user who wants to inspect or act on a task themselves.
 */
export const TASKMARKET_APP_URL = "https://taskmarket.dev";

/**
 * USDC is denominated in 6 decimals on Base, which is how every reward and
 * `netReward` value comes back from the API.
 */
export const USDC_DECIMALS = 6;

/**
 * Ceiling on how many tasks a single browse call will return. Keeping this
 * small matters: the results are pasted into a model context window, and an
 * unbounded list is both expensive and unreadable.
 */
export const MAX_TASKS_RETURNED = 25;

/**
 * Default request timeout in milliseconds.
 */
export const REQUEST_TIMEOUT_MS = 15_000;
