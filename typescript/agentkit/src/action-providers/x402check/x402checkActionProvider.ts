import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { PreflightCheckSchema, VerifyPayToSchema } from "./schemas";
import type { X402checkActionProviderConfig } from "./types";
import { fetchPreflight, formatError, formatToolCheck } from "./utils";
import { resolveBaseUrl } from "./utils";

/**
 * X402checkActionProvider — trust-preflight x402 seller URLs before paying.
 *
 * Calls https://x402check.dev (or a configured origin). Each check costs
 * $0.002 Exact USDC on Base (eip155:8453). Pass a payment-wrapped `fetch`
 * (e.g. `@x402/fetch` wrapFetchWithPayment) via config so 402s settle.
 *
 * Also see {@link createX402checkBeforePayment} to wire the same check into
 * the x402 action provider's `beforePayment` hook (#1402 / #1454).
 *
 * @augments ActionProvider
 */
export class X402checkActionProvider extends ActionProvider {
  private readonly config: X402checkActionProviderConfig;

  /**
   * Create an X402checkActionProvider.
   *
   * @param config - Optional baseUrl, paymentHeaders, fetch, abortOnCaution
   */
  constructor(config: X402checkActionProviderConfig = {}) {
    super("x402check", []);
    this.config = {
      ...config,
      baseUrl: resolveBaseUrl(config),
    };
  }

  /**
   * Trust-check one absolute https x402 seller URL before paying it.
   *
   * Use for: is this endpoint safe/legit; verify payTo; detect price or
   * wallet drift; check uptime; validate 402 payment requirements; budget
   * guard before signing USDC; debug a failing 402.
   *
   * Returns verdict ok|caution|avoid + that tool's history only.
   * Deny payment when verdict=avoid. Escalate on caution. Still enforce
   * maxAmount when ok. Endpoint+history product — not wallet OFAC/simulation.
   *
   * @param args - url + optional fresh flag
   * @returns JSON string with ToolCheck fields and guidance
   */
  @CreateAction({
    name: "preflight_check",
    description: `
Trust-check one absolute https x402 seller URL BEFORE paying it (x402check).

Use when about to settle / sign PAYMENT-SIGNATURE to a third-party x402 tool:
- is this endpoint safe / reachable / presenting a valid 402?
- verify the receiving wallet (payTo) and detect wallet/price drift via history
- uptime and recent probe history for that URL only
- budget guard / debug a failing 402 settle

Returns verdict ok|caution|avoid + history (checks, uptimePct, payToChanges, priceChanges).
If verdict=avoid do NOT pay. If caution, escalate. If ok, still enforce maxAmount.

Billed $0.002 USDC Exact on Base per check (configure payment-wrapped fetch).
Not an OFAC/drainer/simulation scan of a wallet — endpoint + history only.
    `,
    schema: PreflightCheckSchema,
  })
  async preflightCheck(args: z.infer<typeof PreflightCheckSchema>): Promise<string> {
    try {
      const check = await fetchPreflight(args.url, this.config, args.fresh === true);
      return formatToolCheck(check);
    } catch (error: unknown) {
      return formatError(error);
    }
  }

  /**
   * Verify the receiving wallet (payTo) from a seller's live 402 challenge,
   * with history of wallet rotations. Same billing as preflight_check.
   *
   * @param args - url, optional expectedPayTo, optional fresh
   * @returns JSON string focused on payTo + history.payToChanges
   */
  @CreateAction({
    name: "verify_payto",
    description: `
Verify the receiving wallet (payTo) from an x402 seller's live 402 challenge before signing USDC.

Extracts payTo + network + priceUsd from the live challenge and returns that tool's
payTo change history (wallet rotations). Optionally compare against expectedPayTo.

Same $0.002 USDC Exact billing as preflight_check (same /preflight endpoint).
Deny payment when verdict=avoid. Escalate on caution or payTo mismatch vs expectedPayTo.
    `,
    schema: VerifyPayToSchema,
  })
  async verifyPayTo(args: z.infer<typeof VerifyPayToSchema>): Promise<string> {
    try {
      const check = await fetchPreflight(args.url, this.config, args.fresh === true);

      const expected = args.expectedPayTo?.trim() || null;
      let payToMatch: boolean | null = null;
      let mismatchNote: string | undefined;

      if (expected && check.payTo) {
        payToMatch = expected.toLowerCase() === check.payTo.toLowerCase();
        if (!payToMatch) {
          mismatchNote = `Live payTo ${check.payTo} does not match expectedPayTo ${expected}`;
        }
      } else if (expected && !check.payTo) {
        payToMatch = false;
        mismatchNote = `No payTo in live challenge; expected ${expected}`;
      }

      return formatToolCheck(check, {
        action: "verify_payto",
        expectedPayTo: expected,
        payToMatch,
        payToChanges: check.history?.payToChanges ?? [],
        ...(mismatchNote ? { mismatch: mismatchNote } : {}),
      });
    } catch (error: unknown) {
      return formatError(error);
    }
  }

  /**
   * x402check is network-agnostic (HTTP trust preflight).
   *
   * @param _ - Network (unused)
   * @returns Always true
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }
}

/**
 * Factory for {@link X402checkActionProvider}.
 *
 * @param config - Optional configuration
 * @returns New provider instance
 */
export const x402checkActionProvider = (config: X402checkActionProviderConfig = {}) =>
  new X402checkActionProvider(config);
