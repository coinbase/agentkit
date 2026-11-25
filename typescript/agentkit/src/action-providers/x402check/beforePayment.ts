import type {
  X402BeforePaymentContext,
  X402BeforePaymentDecision,
  X402checkActionProviderConfig,
  X402checkToolCheck,
} from "./types";
import { fetchPreflight, shouldAbort } from "./utils";

/**
 * Build a human-readable reason from a ToolCheck + optional mismatch notes.
 *
 * @param check - Live ToolCheck
 * @param extras - Extra notes (payTo / network mismatch)
 * @returns Reason string
 */
function buildReason(check: X402checkToolCheck, extras: string[] = []): string {
  const payToNote = check.payTo ? ` payTo=${check.payTo}` : "";
  const networkNote = check.network ? ` network=${check.network}` : "";
  const priceNote =
    check.priceUsd !== undefined && check.priceUsd !== null ? ` priceUsd=${check.priceUsd}` : "";
  const codes = check.reasonCodes?.length ? ` reasons=${check.reasonCodes.join(",")}` : "";
  const historyBits: string[] = [];
  if (check.history?.payToChanges?.length) {
    historyBits.push(`payToChanges=${check.history.payToChanges.length}`);
  }
  if (check.history?.priceChanges?.length) {
    historyBits.push(`priceChanges=${check.history.priceChanges.length}`);
  }
  if (typeof check.history?.uptimePct === "number") {
    historyBits.push(`uptimePct=${check.history.uptimePct}`);
  }
  const historyNote = historyBits.length ? ` history={${historyBits.join(",")}}` : "";
  const extraNote = extras.length ? ` ${extras.join(" ")}` : "";
  return `x402check verdict=${check.verdict}${payToNote}${networkNote}${priceNote}${codes}${historyNote}${extraNote}`;
}

/**
 * Build a `beforePayment` hook compatible with the x402 action provider
 * hook proposed in coinbase/agentkit#1402 / implemented in #1454.
 *
 * Runs a live x402check preflight against `ctx.url` immediately before
 * settlement and returns the exact {@link X402BeforePaymentDecision} shape
 * (`{ abort, reason?, code? }`) so it drops into `X402Config.beforePayment`.
 *
 * Maps x402check's `ok | caution | avoid` verdict (live 402 price / network /
 * payTo vs that URL's history, including payTo-change detection) into the
 * decision. Policy knobs:
 * - always abort on `avoid`
 * - optionally abort on `caution` (`abortOnCaution`)
 * - always abort on live `payTo` ≠ context `payTo` (requirements integrity)
 * - network mismatch aborts only when `abortOnCaution` is set (else noted in reason)
 * - fail closed by default on check errors; set `failOpen: true` to proceed
 *
 * Types are defined locally (see {@link X402BeforePaymentContext}) so this
 * works before #1454 merges — no imports of unmerged x402-provider symbols.
 *
 * Provider-neutral: does not import sanctions/OFAC backends — only endpoint
 * + history signals from https://x402check.dev.
 *
 * @param config - x402check config (baseUrl, payment-wrapped fetch, policy)
 * @returns Async beforePayment function for X402Config.beforePayment
 *
 * @example
 * ```ts
 * import { x402ActionProvider, createX402checkBeforePayment } from "@coinbase/agentkit";
 *
 * // One-line drop-in for the #1454 beforePayment seat:
 * const x402 = x402ActionProvider({
 *   registeredServices: ["https://api.example.com"],
 *   beforePayment: createX402checkBeforePayment({ fetch: paidFetch }),
 * });
 * ```
 */
export function createX402checkBeforePayment(
  config: X402checkActionProviderConfig = {},
): (ctx: X402BeforePaymentContext) => Promise<X402BeforePaymentDecision> {
  const failOpen = config.failOpen === true;
  const abortOnCaution = config.abortOnCaution === true;

  return async (ctx: X402BeforePaymentContext): Promise<X402BeforePaymentDecision> => {
    if (!ctx?.url) {
      if (failOpen) {
        return {
          abort: false,
          reason: "x402check: missing url in beforePayment context (failOpen)",
          code: "x402check:unavailable",
        };
      }
      return {
        abort: true,
        reason: "x402check: missing url in beforePayment context",
        code: "x402check:missing_url",
      };
    }

    let check: X402checkToolCheck;
    try {
      check = await fetchPreflight(ctx.url, config, /* fresh */ true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (failOpen) {
        return {
          abort: false,
          reason: `x402check preflight failed (failOpen): ${message}`,
          code: "x402check:unavailable",
        };
      }
      return {
        abort: true,
        reason: `x402check preflight failed: ${message}`,
        code: "x402check:preflight_failed",
      };
    }

    const extras: string[] = [];

    // Requirements integrity: live challenge payTo vs the option about to be paid.
    if (ctx.payTo && check.payTo && ctx.payTo.toLowerCase() !== check.payTo.toLowerCase()) {
      extras.push(`payToMismatch context=${ctx.payTo} live=${check.payTo}`);
      return {
        abort: true,
        reason: buildReason(check, extras),
        code: "x402check:payto_mismatch",
      };
    }

    // Soft signal: network on the live challenge differs from the selected option.
    if (ctx.network && check.network && ctx.network.toLowerCase() !== check.network.toLowerCase()) {
      extras.push(`networkMismatch context=${ctx.network} live=${check.network}`);
      if (abortOnCaution) {
        return {
          abort: true,
          reason: buildReason(check, extras),
          code: "x402check:network_mismatch",
        };
      }
    }

    if (shouldAbort(check.verdict, abortOnCaution)) {
      return {
        abort: true,
        reason: buildReason(check, extras),
        code: `x402check:${check.verdict}`,
      };
    }

    return {
      abort: false,
      reason: buildReason(check, extras),
      code: `x402check:${check.verdict}`,
    };
  };
}
