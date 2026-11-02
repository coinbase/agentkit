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
 * Configuration for {@link X402checkActionProvider} and
 * {@link createX402checkBeforePayment}.
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
   * When true, beforePayment treats `caution` like `avoid` (abort).
   * Default: false (caution is reported via `code`/`reason` but does not abort).
   */
  abortOnCaution?: boolean;

  /**
   * When true, preflight failures (network/HTTP/payment errors, missing url)
   * allow payment to proceed (`abort: false`, `code: "x402check:unavailable"`).
   * Default: false (fail closed — refuse when the check cannot evaluate).
   */
  failOpen?: boolean;
}

/**
 * Context passed to a `beforePayment` hook.
 *
 * Locally mirrors coinbase/agentkit#1454's `X402BeforePaymentContext` so
 * {@link createX402checkBeforePayment} is a drop-in for `X402Config.beforePayment`
 * before that PR merges. Defined here on purpose — do not import unmerged
 * symbols from the x402 provider.
 */
export interface X402BeforePaymentContext {
  /** The service URL being paid. */
  url: string;
  /** Recipient address (v2 `payTo`), or `null` if the selected option did not declare one. */
  payTo: string | null;
  /** CAIP-2 network of the selected payment option. */
  network: string;
  /** Asset address / identifier being paid. */
  asset: string;
  /** Amount to be paid, as the option declared it (atomic or whole-unit string). */
  amount: string;
  /** HTTP method of the request being paid for. */
  method: string;
  /**
   * The full PaymentRequired object as decoded from the 402, or `null`.
   * Canonical source for a requirements-integrity check.
   */
  paymentRequirements?: Record<string, unknown> | null;
  /**
   * The raw, still-base64-encoded `PAYMENT-REQUIRED` header value (v2), or `null`.
   */
  paymentRequirementsHeader?: string | null;
}

/**
 * Decision returned by a `beforePayment` hook.
 *
 * Exact shape of coinbase/agentkit#1454's `X402BeforePaymentDecision`
 * (`{ abort, reason?, code? }`). No extra fields, so #1454's unrecognized-shape
 * fail-closed guard accepts it as a recognized decision.
 */
export interface X402BeforePaymentDecision {
  /** When `true`, the payment is refused and never signed or settled. */
  abort: boolean;
  /** Optional human-readable reason surfaced in the action result. */
  reason?: string;
  /**
   * Optional machine-readable reason code (e.g. `x402check:avoid`),
   * preserved across the hook boundary so autonomous callers can branch
   * without parsing the human-readable `reason`.
   */
  code?: string;
}
