import { TOKEN_VERDICT_CAIP2, TOKEN_VERDICT_PAY_TO, TOKEN_VERDICT_PRICE_ATOMIC } from "./constants";

export type TokenVerdict = "clean" | "caution" | "rug_risk" | "exit_trap";

/**
 * A verdict card as returned by the Token Verdict endpoint.
 */
export interface TokenVerdictCard {
  verdict: TokenVerdict;
  score: number;
  reasons?: string[];
  facts?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * The gate rule: only clean / caution may proceed to a trade.
 * Unknown or missing verdicts block — fail closed, never open.
 *
 * @param card - The verdict card (or its verdict string)
 * @returns True if a trade may proceed
 */
export function isTradeAllowed(card: { verdict?: string } | string | null | undefined): boolean {
  const verdict = typeof card === "string" ? card : card?.verdict;
  return verdict === "clean" || verdict === "caution";
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
 * is signed. The check is pinned to the known Token Verdict terms:
 * exact scheme, Base mainnet, at most $0.02, and the known payTo.
 * Anything else must not be paid.
 *
 * @param accepts - Payment options from the 402 response
 * @param maxPaymentAtomic - Caller's cap, in atomic USDC
 * @returns An error string, or null when the payment is as expected
 */
export function validateTokenVerdictPayment(
  accepts: PaymentRequirement[] | undefined,
  maxPaymentAtomic: string = TOKEN_VERDICT_PRICE_ATOMIC,
): string | null {
  if (!accepts || accepts.length === 0) return "402 response carried no payment options";
  const option = accepts.find(o => o.network === TOKEN_VERDICT_CAIP2) ?? accepts[0];
  if (option.network !== TOKEN_VERDICT_CAIP2) {
    return `Unexpected payment network "${option.network}" (expected ${TOKEN_VERDICT_CAIP2})`;
  }
  if (option.payTo && option.payTo.toLowerCase() !== TOKEN_VERDICT_PAY_TO.toLowerCase()) {
    return `Unexpected payment recipient "${option.payTo}"`;
  }
  const amount = option.amount ?? option.maxAmountRequired;
  if (!amount || BigInt(amount) > BigInt(maxPaymentAtomic)) {
    return `Payment amount "${amount}" exceeds the $0.02 Token Verdict price`;
  }
  return null;
}
