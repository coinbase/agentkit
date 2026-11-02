import { DEFAULT_X402CHECK_BASE_URL, X402CHECK_SKIP_ENV, X402CHECK_URL_ENV } from "./constants";
import type { X402checkActionProviderConfig, X402checkToolCheck, X402checkVerdict } from "./types";

/**
 * Resolve the x402check API origin (no trailing slash).
 *
 * @param config - Provider config
 * @returns Base URL string
 */
export function resolveBaseUrl(config: X402checkActionProviderConfig = {}): string {
  const fromConfig = config.baseUrl?.trim();
  const fromEnv = process.env[X402CHECK_URL_ENV]?.trim();
  const raw = fromConfig || fromEnv || DEFAULT_X402CHECK_BASE_URL;
  return raw.replace(/\/$/, "");
}

/**
 * Whether the skip kill-switch is enabled.
 *
 * @returns True when X402CHECK_SKIP=1
 */
export function isSkipEnabled(): boolean {
  return process.env[X402CHECK_SKIP_ENV] === "1";
}

/**
 * Build a synthetic ok ToolCheck used when skip is enabled.
 *
 * @param url - Seller URL
 * @returns Synthetic ToolCheck
 */
export function skippedToolCheck(url: string): X402checkToolCheck {
  return {
    url,
    verdict: "ok",
    reasonCodes: ["preflight_skipped"],
    history: { checks: 0 },
    checkedAt: new Date().toISOString(),
    live: false,
  };
}

/**
 * Call GET /preflight for one seller URL.
 *
 * @param sellerUrl - Absolute https seller URL
 * @param config - Provider config (baseUrl, paymentHeaders, fetch)
 * @param fresh - Force live probe
 * @returns Parsed ToolCheck
 */
export async function fetchPreflight(
  sellerUrl: string,
  config: X402checkActionProviderConfig = {},
  fresh = false,
): Promise<X402checkToolCheck> {
  if (isSkipEnabled()) {
    return skippedToolCheck(sellerUrl);
  }

  const base = resolveBaseUrl(config);
  const fetchImpl = config.fetch ?? fetch;
  const q = new URLSearchParams({ url: sellerUrl });
  if (fresh) {
    q.set("fresh", "1");
  }

  const res = await fetchImpl(`${base}/preflight?${q.toString()}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(config.paymentHeaders ?? {}),
    },
  });

  if (res.status === 402) {
    const paymentRequired =
      res.headers.get("PAYMENT-REQUIRED") ?? res.headers.get("payment-required");
    throw Object.assign(new Error("x402check_payment_required"), {
      status: 402,
      paymentRequired,
      hint:
        "x402check charges $0.01 USDC Exact on Base (eip155:8453) per check. " +
        "Pass config.fetch = wrapFetchWithPayment(...) from @x402/fetch, or set paymentHeaders with a PAYMENT-SIGNATURE.",
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`x402check_http_${res.status}`), {
      status: res.status,
      body: body.slice(0, 500),
    });
  }

  return (await res.json()) as X402checkToolCheck;
}

/**
 * Format a ToolCheck as agent-readable JSON text.
 *
 * @param check - ToolCheck
 * @param extras - Optional extra fields merged into the top level
 * @returns JSON string
 */
export function formatToolCheck(
  check: X402checkToolCheck,
  extras?: Record<string, unknown>,
): string {
  return JSON.stringify(
    {
      success: true,
      ...extras,
      url: check.url,
      verdict: check.verdict,
      payTo: check.payTo ?? null,
      priceUsd: check.priceUsd ?? null,
      network: check.network ?? null,
      is402: check.is402 ?? null,
      reasonCodes: check.reasonCodes ?? [],
      history: check.history ?? null,
      checkedAt: check.checkedAt ?? null,
      live: check.live ?? null,
      guidance:
        check.verdict === "avoid"
          ? "Do not pay this seller."
          : check.verdict === "caution"
            ? "Escalate / require confirmation before paying; still enforce maxAmount."
            : "Verdict ok — still enforce your maxAmount and allowlist rules.",
    },
    null,
    2,
  );
}

/**
 * Format a thrown error as agent-readable JSON.
 *
 * @param error - Unknown error
 * @returns JSON string
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const extra: Record<string, unknown> = {
      success: false,
      error: error.message,
    };
    const withStatus = error as Error & {
      status?: number;
      hint?: string;
      paymentRequired?: string;
      body?: string;
    };
    if (withStatus.status !== undefined) extra.status = withStatus.status;
    if (withStatus.hint) extra.hint = withStatus.hint;
    if (withStatus.paymentRequired) extra.paymentRequired = withStatus.paymentRequired;
    if (withStatus.body) extra.body = withStatus.body;
    return JSON.stringify(extra, null, 2);
  }
  return JSON.stringify({ success: false, error: String(error) }, null, 2);
}

/**
 * Decide whether a verdict should abort payment.
 *
 * @param verdict - ToolCheck verdict
 * @param abortOnCaution - Treat caution as abort
 * @returns True when payment should be refused
 */
export function shouldAbort(verdict: X402checkVerdict, abortOnCaution = false): boolean {
  if (verdict === "avoid") return true;
  if (verdict === "caution" && abortOnCaution) return true;
  return false;
}
