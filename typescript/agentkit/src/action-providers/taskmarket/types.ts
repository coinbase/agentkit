/**
 * Configuration options for the TaskMarketActionProvider.
 */
export interface TaskMarketActionProviderConfig {
  /**
   * Override the TaskMarket API base URL. Mainly useful for testing or for
   * pointing at a staging deployment.
   */
  baseUrl?: string;
}

/**
 * A task as returned by the TaskMarket public API.
 *
 * Only the fields this provider actually reads are typed. The API returns a
 * considerably wider object (auction parameters, pitch counts, escrow hashes),
 * and pinning all of it here would make this file wrong the first time the
 * upstream schema grows.
 */
export interface TaskMarketTask {
  id: string;
  description: string;
  status: string;
  phase?: string;
  mode?: string;
  /** Gross reward in USDC base units (6 decimals). */
  reward?: string | number;
  /** Reward after the platform fee, in USDC base units (6 decimals). */
  netReward?: string | number;
  platformFeeBps?: number;
  expiryTime?: string;
  createdAt?: string;
  submissionCount?: number;
  awardCount?: number;
  claimedBy?: string | null;
  submissionWindowOpen?: boolean;
  tags?: string[];
  requester?: string;
}

/**
 * Shape of the list response from `GET /api/tasks`.
 */
export interface TaskMarketTaskListResponse {
  tasks: TaskMarketTask[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

/**
 * A task reduced to the fields worth spending context-window tokens on.
 */
export interface TaskMarketTaskSummary {
  id: string;
  url: string;
  summary: string;
  netRewardUsdc: number;
  submissionCount: number;
  expiresAt: string | null;
  hoursRemaining: number | null;
  tags: string[];
}
