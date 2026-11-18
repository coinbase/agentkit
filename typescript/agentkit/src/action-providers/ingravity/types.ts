export interface IngravityActionProviderConfig {
  /**
   * Gateway URL for the Ingravity Cloudflare Edge Worker.
   * Defaults to https://red-shape-1b3b.daviddelmoral79.workers.dev.
   */
  workerUrl?: string;

  /**
   * Maximum USDC expenditure allowed per action call (e.g., 0.10).
   * If a 402 payment requirement exceeds this cap, the call halts before signing.
   */
  maxSpendUsdc?: number;

  /**
   * Optional capital at risk in USD under agent management for firewall SLA quoting.
   */
  capitalAtRiskUsd?: number;

  /**
   * Whether to cache X-Ingravity-Receipt-Token headers within the session to avoid duplicate spend.
   * Defaults to true.
   */
  enableReceiptCache?: boolean;
}

export interface X402AcceptOption {
  scheme?: string;
  network?: string;
  asset?: string;
  payTo?: string;
  amount?: string;
  maxAmountRequired?: string;
  extra?: Record<string, unknown>;
}

export interface X402ChallengePayload {
  x402Version?: number;
  error?: string;
  accepts?: X402AcceptOption[];
}

export interface IngravityExecutionOptions {
  tier?: "FULL" | "ESSENTIAL";
  cacheTarget?: string;
}
