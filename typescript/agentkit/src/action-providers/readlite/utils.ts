import {
  READ_LITE_CAIP2,
  READ_LITE_MAX_MARKDOWN_CHARS,
  READ_LITE_PAY_TO,
  READ_LITE_PRICE_ATOMIC,
} from "./constants";

/**
 * A page as returned by the Read Lite endpoint: the fetched URL, its
 * title and excerpt, the clean Markdown body, and the full word count.
 */
export interface ReadLitePage {
  url: string;
  title?: string;
  excerpt?: string;
  markdown: string;
  wordCount?: number;
  [key: string]: unknown;
}

/**
 * Caps the returned markdown so a single huge page cannot flood the
 * agent's context. Returns the page unchanged when it fits; otherwise
 * the markdown is cut at the cap and `markdownTruncated` is set (the
 * endpoint's `wordCount` still describes the full page).
 *
 * @param page - The page returned by the endpoint
 * @param maxChars - Maximum markdown characters to keep
 * @returns The page, with markdown truncated if needed
 */
export function truncatePageMarkdown(
  page: ReadLitePage,
  maxChars: number = READ_LITE_MAX_MARKDOWN_CHARS,
): ReadLitePage & { markdownTruncated?: boolean } {
  if (!page.markdown || page.markdown.length <= maxChars) return page;
  return { ...page, markdown: page.markdown.slice(0, maxChars), markdownTruncated: true };
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
 * is signed. The check is pinned to the known Read Lite terms:
 * exact scheme, Base mainnet, at most $0.005, and the known payTo.
 * Anything else must not be paid.
 *
 * @param accepts - Payment options from the 402 response
 * @param maxPaymentAtomic - Caller's cap, in atomic USDC
 * @returns An error string, or null when the payment is as expected
 */
export function validateReadLitePayment(
  accepts: PaymentRequirement[] | undefined,
  maxPaymentAtomic: string = READ_LITE_PRICE_ATOMIC,
): string | null {
  if (!accepts || accepts.length === 0) return "402 response carried no payment options";
  const option = accepts.find(o => o.network === READ_LITE_CAIP2) ?? accepts[0];
  if (option.network !== READ_LITE_CAIP2) {
    return `Unexpected payment network "${option.network}" (expected ${READ_LITE_CAIP2})`;
  }
  if (option.payTo && option.payTo.toLowerCase() !== READ_LITE_PAY_TO.toLowerCase()) {
    return `Unexpected payment recipient "${option.payTo}"`;
  }
  const amount = option.amount ?? option.maxAmountRequired;
  if (!amount || BigInt(amount) > BigInt(maxPaymentAtomic)) {
    return `Payment amount "${amount}" exceeds the $0.005 Read Lite price`;
  }
  return null;
}
