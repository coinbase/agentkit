import { wrapFetchWithPaymentFromConfig, type PaymentPolicy } from "@x402/fetch";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import type { RouteVerdictArgs } from "./schemas";
import {
  BASE_NETWORK,
  BASE_USDC_ADDRESS,
  ROUTE_VERDICT_BASE_URL,
  ROUTE_VERDICT_PATH,
  ROUTE_VERDICT_PRICE,

  USDC_DECIMALS,
} from "./constants";

export interface RouteVerdictOptions {
  /** Service base URL override (default: production). */
  baseUrl?: string;
  /**
   * Spend guard: the maximum amount authorized for a single call.
   * Defaults to each action's known price so a hostile or repriced
   * endpoint can never silently charge more.
   */
  maxAmountPerPayment?: string;
  /** fetch implementation override (used by tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Converts a dollar amount ("$0.05") to atomic USDC units.
 *
 * @param amount - The dollar amount to convert
 * @returns The amount in atomic USDC units
 */
function usdToAtomic(amount: string): bigint {
  const match = /^\$?(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) {
    throw new Error(`Invalid dollar amount: ${amount}`);
  }
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? "").padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return whole * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction || "0");
}

/**
 * Builds the spend-guard policy for the x402 client: only payment
 * requirements payable in USDC on Base at or under the per-call cap are
 * offered to the signer. Anything else is filtered out before payment
 * creation, so the client refuses to pay instead of signing.
 *
 * @param maxAmountPerPayment - The maximum amount authorized per call (e.g. "$0.05")
 * @returns A payment policy enforcing the cap
 */
export function maxAmountPolicy(maxAmountPerPayment: string): PaymentPolicy {
  const maxAmount = usdToAtomic(maxAmountPerPayment);
  return (_x402Version, paymentRequirements) =>
    paymentRequirements.filter(
      requirement =>
        requirement.network === BASE_NETWORK &&
        requirement.asset.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
        BigInt(requirement.amount) <= maxAmount,
    );
}

/**
 * Build a fetch that pays x402 challenges automatically, capped at the
 * given per-call price.
 *
 * This is the standard x402 v2 client flow — `@x402/fetch`'s
 * `wrapFetchWithPaymentFromConfig` + `@x402/evm`'s `ExactEvmScheme`
 * (`exact` scheme, EIP-3009 USDC authorization on Base) — with the
 * signer supplied by the caller: in the AgentKit provider, the wallet
 * provider's own account (`EvmWalletProvider.toSigner()`). Settlement
 * is verified by the service through its facilitator server-side,
 * exactly as with any x402 client.
 *
 * @param signer - The EVM signer that authorizes payments
 * @param price - The per-call spend cap for this call
 * @param options - Optional base URL / spend-guard overrides
 * @returns A fetch function that handles 402 responses automatically
 */
export function createPayingFetch(
  signer: ClientEvmSigner,
  price: string,
  options: RouteVerdictOptions = {},
): typeof fetch {
  return wrapFetchWithPaymentFromConfig(options.fetchImpl ?? fetch, {
    schemes: [{ network: BASE_NETWORK, client: new ExactEvmScheme(signer) }],
    policies: [maxAmountPolicy(options.maxAmountPerPayment ?? price)],
  });
}

/**
 * Call POST /v1/check with automatic x402 payment and return the trust
 * verdict JSON: { verdict: TRUSTED|CAUTION|AVOID, score, reasons[],
 * liveness, terms, schema_quality, catalog, diff }.
 *
 * Throws on a non-200 response (including a 402 the signer could not or
 * would not settle, e.g. a price above the spend guard).
 *
 * @param signer - The EVM signer that authorizes the payment
 * @param args - The resource URL to audit
 * @param options - Optional base URL / spend-guard overrides
 * @returns The parsed response JSON
 */
export async function fetchRouteVerdict(
  signer: ClientEvmSigner,
  args: RouteVerdictArgs,
  options: RouteVerdictOptions = {},
): Promise<Record<string, unknown>> {
  const baseUrl = (options.baseUrl ?? ROUTE_VERDICT_BASE_URL).replace(/\/$/, "");
  const payingFetch = createPayingFetch(signer, ROUTE_VERDICT_PRICE, options);
  const response = await payingFetch(`${baseUrl}${ROUTE_VERDICT_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resource_url: args.resource_url }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed: HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

