/**
 * Taskmarket integration constants.
 *
 * Taskmarket runs on Base L2 and escrows payouts in USDC. REST reward amounts
 * are integer base-unit strings (6 decimals); the CLI accepts human-readable
 * USDC.
 */

/** Production Taskmarket API base URL. */
export const TASKMARKET_API_URL = process.env.TASKMARKET_API_URL ?? "https://api.taskmarket.dev";

/** The Taskmarket backend serves REST under /api. */
export const TASKMARKET_API_BASE = `${TASKMARKET_API_URL}/api`;

/** USDC has 6 decimals on Base. */
export const USDC_DECIMALS = 6;

/** Base Mainnet chain id, where Taskmarket escrows USDC. */
export const BASE_CHAIN_ID = 8453;

/** USDC (native) contract on Base Mainnet. */
export const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Human-friendly USDC display used in task URLs. */
export const TASKMARKET_APP_URL = "https://taskmarket.dev";

/**
 * Default hard cap on a single task's total spend in USDC. Generated task
 * creation refuses to go above this unless the caller passes a higher
 * maxSpendUsdc, and it never lets the agent pay more than the exact cost.
 */
export const DEFAULT_MAX_TASK_SPEND_USDC = parseFloat(
  process.env.TASKMARKET_MAX_TASK_SPEND_USDC ?? "25",
);

/** The first-party Taskmarket CLI used for the funded write path. */
export const TASKMARKET_CLI = process.env.TASKMARKET_CLI ?? "taskmarket";

/** How long the CLI write may run before being treated as in-flight. */
export const TASKMARKET_CLI_TIMEOUT_MS = parseInt(
  process.env.TASKMARKET_CLI_TIMEOUT_MS ?? "180000",
  10,
);

/** Regex matching a 64-hex-char Taskmarket task id. */
export const TASKMARKET_TASK_ID_REGEX = /0x[0-9a-fA-F]{64}/;
