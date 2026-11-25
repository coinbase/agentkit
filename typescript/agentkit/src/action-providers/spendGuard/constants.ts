/**
 * Default hosted endpoint of the A2P-32 spend guard.
 *
 * The guard is an HTTP contract, not a vendor lock: set SPEND_GUARD_URL to any
 * compatible server. The endpoint accepts `POST /v1/guard` with
 * `{ "orders": [...] }` and answers the same JSON shape.
 */
export const DEFAULT_SPEND_GUARD_URL =
  process.env.SPEND_GUARD_URL ?? "https://zealous-unburned-tameness.ngrok-free.dev";

/**
 * The limits the guard can enforce. `value` is sent in the limit's own scale;
 * `value_dec` is the human unit (73.5 USD -> 73.5).
 */
export const SPEND_GUARD_ROOTS = [
  "BUDGET.USD",
  "API.RATE",
  "DB.WRITE",
  "TRANSFER.LIMIT",
  "TOKEN.BURN",
  "QUEUE.BATCH",
  "RETRY.LOOP",
  "SESSION.LOCK",
] as const;

export const SPEND_GUARD_ACTIONS = [
  "READ",
  "SET",
  "INCREASE",
  "DECREASE",
  "OPEN",
  "CLOSE",
  "STOP",
] as const;
