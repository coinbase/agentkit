import type {
  X402BeforePaymentContext,
  X402BeforePaymentDecision,
  X402checkActionProviderConfig,
} from "./types";
import { fetchPreflight, shouldAbort } from "./utils";

/**
 * Build a `beforePayment` hook compatible with the x402 action provider
 * hook proposed in coinbase/agentkit#1402 / implemented in #1454.
 *
 * Runs a live x402check preflight against `ctx.url` immediately before
 * settlement. Returns `{ abort: true, reason }` when the verdict is `avoid`
 * (and optionally `caution` when `abortOnCaution` is set).
 *
 * Provider-neutral: does not import sanctions/OFAC backends — only endpoint
 * + history signals from https://x402check.dev (payTo/price drift, uptime).
 *
 * @param config - x402check config (baseUrl, payment-wrapped fetch, etc.)
 * @returns Async beforePayment function for X402Config.beforePayment
 *
 * @example
 * ```ts
 * import { x402ActionProvider } from "@coinbase/agentkit";
 * import { createX402checkBeforePayment } from "@coinbase/agentkit";
 * import { wrapFetchWithPayment } from "@x402/fetch";
 *
 * const paidFetch = wrapFetchWithPayment(fetch, /* signer / schemes *\/);
 *
 * const x402 = x402ActionProvider({
 *   registeredServices: ["https://api.example.com"],
 *   beforePayment: createX402checkBeforePayment({ fetch: paidFetch }),
 * });
 * ```
 */
export function createX402checkBeforePayment(
  config: X402checkActionProviderConfig = {},
): (ctx: X402BeforePaymentContext) => Promise<X402BeforePaymentDecision> {
  return async (ctx: X402BeforePaymentContext): Promise<X402BeforePaymentDecision> => {
    if (!ctx.url) {
      return { abort: true, reason: "x402check: missing url in beforePayment context" };
    }

    let check;
    try {
      check = await fetchPreflight(ctx.url, config, /* fresh */ true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // Fail closed on payment/network errors for the check itself — caller
      // can catch and decide. Returning abort keeps settlement from proceeding
      // without a trust signal.
      return {
        abort: true,
        reason: `x402check preflight failed: ${message}`,
      };
    }

    if (shouldAbort(check.verdict, config.abortOnCaution === true)) {
      const payToNote = check.payTo ? ` payTo=${check.payTo}` : "";
      const codes = check.reasonCodes?.length ? ` reasons=${check.reasonCodes.join(",")}` : "";
      return {
        abort: true,
        reason: `x402check verdict=${check.verdict}${payToNote}${codes}`,
        check,
      };
    }

    // Optional: if caller passed expected payTo via amount/context — when
    // beforePayment context includes payTo, surface a caution-style abort
    // if the live challenge payTo differs and abortOnCaution is on.
    if (
      ctx.payTo &&
      check.payTo &&
      ctx.payTo.toLowerCase() !== check.payTo.toLowerCase() &&
      config.abortOnCaution === true
    ) {
      return {
        abort: true,
        reason: `x402check payTo mismatch: context=${ctx.payTo} live=${check.payTo}`,
        check,
      };
    }

    return { abort: false, reason: `x402check verdict=${check.verdict}`, check };
  };
}
