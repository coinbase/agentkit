/**
 * Default Taskmarket API endpoint.
 */
export const TASKMARKET_BASE_URL = "https://api.taskmarket.dev";

/**
 * Maximum default escrow amount allowed by the action provider.
 *
 * This is a guardrail for agents. Applications can provide a lower limit in
 * the provider configuration, but cannot raise the default without opting in.
 */
export const DEFAULT_MAX_REWARD_USDC = 100;
