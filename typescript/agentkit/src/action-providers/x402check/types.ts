/**
 * Trust verdict returned by x402check for a seller URL.
 */
export type X402checkVerdict = "ok" | "caution" | "avoid";

/**
 * Compact per-tool history summary from x402check.
 */
export interface X402checkHistory {
  checks: number;
  uptimePct?: number | null;
  lastOkAt?: string | null;
  lastFailAt?: string | null;
  payToChanges?: Array<{ at: string; from: string; to: string }>;
  priceChanges?: Array<{ at: string; fromUsd: number | null; toUsd: number | null }>;
  recent?: Array<{
    at: string;
    live?: boolean;
    verdict?: X402checkVerdict;
    status?: number | null;
    priceUsd?: number | null;
    payTo?: string | null;
  }>;
}

/**
 * Compact ToolCheck report from GET /preflight.
 * Field names match https://x402check.dev/docs — endpoint+history only (not OFAC/simulation).
 */
export interface X402checkToolCheck {
  url: string;
  verdict: X402checkVerdict;
  checkedAt?: string;
  live?: boolean;
  cacheAgeMs?: number;
  status?: number | null;
  latencyMs?: number | null;
  is402?: boolean;
  priceUsd?: number | null;
  payTo?: string | null;
  network?: string | null;
  reasonCodes?: string[];
  history?: X402checkHistory;
}

/**
 * Configuration for {@link X402checkActionProvider}.
 */
export interface X402checkActionProviderConfig {
  /**
   * Origin of the x402check API (no trailing slash).
   * Defaults to `https://x402check.dev` or `process.env.X402CHECK_URL`.
   */
  baseUrl?: string;

  /**
   * Headers to attach on every preflight request (e.g. a prior `PAYMENT-SIGNATURE`
   * for the $0.002 Exact USDC Base charge). Prefer {@link fetch} when using
   * `@x402/fetch` `wrapFetchWithPayment`.
   */
  paymentHeaders?: Record<string, string>;

  /**
   * Custom fetch implementation. Pass a payment-wrapped fetch
   * (`wrapFetchWithPayment(...)`) so unpaid 402s are settled automatically.
   * Defaults to global `fetch`.
   */
  fetch?: typeof fetch;

  /**
   * When true, `verify_payto` / beforePayment treat `caution` like `avoid`.
   * Default: false (caution is reported but does not abort).
   */
  abortOnCaution?: boolean;
}

/**
 * Context passed to a `beforePayment` hook (matches coinbase/agentkit#1454).
 * Defined locally so this helper works before that PR merges.
 */
export interface X402BeforePaymentContext {
  payTo?: string | null;
  url: string;
  network?: string | null;
  asset?: string | null;
  amount?: string | number | null;
  method?: string | null;
}

/**
 * Decision returned by a `beforePayment` hook.
 */
export interface X402BeforePaymentDecision {
  abort?: boolean;
  reason?: string;
  /** Full ToolCheck when a live preflight ran (useful for logging). */
  check?: X402checkToolCheck;
}
