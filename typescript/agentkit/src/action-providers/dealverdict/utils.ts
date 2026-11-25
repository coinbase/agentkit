import { DEAL_VERDICT_CAIP2, DEAL_VERDICT_PAY_TO, DEAL_VERDICT_PRICE_ATOMIC } from "./constants";

export type DealVerdict = "real_deal" | "fake_discount" | "overpriced" | "fair";

/**
 * One priced source cited by the Deal Verdict endpoint.
 */
export interface DealPricedSource {
  price: number;
  url: string;
  title: string;
  store: string;
}

/**
 * A verdict card as returned by the Deal Verdict endpoint.
 */
export interface DealVerdictCard {
  product: string;
  url: string | null;
  verdict: DealVerdict;
  inputPrice: number;
  compareAtPrice: number | null;
  lowestFound: { price: number; sourceUrl: string; store: string };
  typicalPrice: number;
  savingsVsTypical: number;
  sources: DealPricedSource[];
  sourceCount: number;
  [key: string]: unknown;
}

/**
 * The gate rule: only real_deal / fair may proceed to a purchase.
 * fake_discount / overpriced block the purchase at this price (buy at
 * the card's lowestFound instead, or renegotiate). Unknown or missing
 * verdicts block — fail closed, never open.
 *
 * @param card - The verdict card (or its verdict string)
 * @returns True if buying at the checked price may proceed
 */
export function isBuyAllowed(card: { verdict?: string } | string | null | undefined): boolean {
  const verdict = typeof card === "string" ? card : card?.verdict;
  return verdict === "real_deal" || verdict === "fair";
}

/**
 * One payment option from an x402 402 response.
 */
export interface PaymentRequirement {
  scheme?: string;
  network?: string;
  amount?: string;
  maxAmountRequired?: string;
  asset?: string;
  payTo?: string;
}

/**
 * Decodes a v2 `payment-required` header (base64 JSON). Returns null
 * when the header is absent or undecodable.
 *
 * @param header - The raw payment-required header value
 * @returns The payment requirements, if any
 */
export function decodePaymentRequirements(
  header: string | null | undefined,
): { accepts?: PaymentRequirement[] } | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Validates the payment an endpoint is asking for before any payment
 * is signed. The check is pinned to the known Deal Verdict terms:
 * exact scheme, Base mainnet, at most $0.01, and the known payTo.
 * Anything else must not be paid.
 *
 * @param accepts - Payment options from the 402 response
 * @param maxPaymentAtomic - Caller's cap, in atomic USDC
 * @returns An error string, or null when the payment is as expected
 */
export function validateDealVerdictPayment(
  accepts: PaymentRequirement[] | undefined,
  maxPaymentAtomic: string = DEAL_VERDICT_PRICE_ATOMIC,
): string | null {
  if (!accepts || accepts.length === 0) return "402 response carried no payment options";
  const option = accepts.find(o => o.network === DEAL_VERDICT_CAIP2) ?? accepts[0];
  if (option.network !== DEAL_VERDICT_CAIP2) {
    return `Unexpected payment network "${option.network}" (expected ${DEAL_VERDICT_CAIP2})`;
  }
  if (option.payTo && option.payTo.toLowerCase() !== DEAL_VERDICT_PAY_TO.toLowerCase()) {
    return `Unexpected payment recipient "${option.payTo}"`;
  }
  const amount = option.amount ?? option.maxAmountRequired;
  if (!amount || BigInt(amount) > BigInt(maxPaymentAtomic)) {
    return `Payment amount "${amount}" exceeds the $0.01 Deal Verdict price`;
  }
  return null;
}
