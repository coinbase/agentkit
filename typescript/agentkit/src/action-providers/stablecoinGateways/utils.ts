import { EvmWalletProvider } from "../../wallet-providers";
import { getX402Networks, isUsdcAsset, validatePaymentLimit } from "../x402/utils";

/**
 * One payment option parsed from an x402 402 response.
 */
export interface QuotedPayment {
  /** CAIP-2 network, for example eip155:8453, or a legacy network id. */
  network: string;
  /** Asset address or code. USDC is a contract address. */
  asset: string;
  /** v2 atomic amount. */
  amount?: string;
  /** v1 atomic amount. */
  maxAmountRequired?: string;
}

/**
 * Result of choosing the USDC option this wallet is allowed to pay.
 */
export type UsdcPaymentSelection =
  | { ok: true; amount: string }
  | { ok: false; message: string; details: string; maxPaymentUsdc?: number };

/**
 * Builds an absolute GET URL, omitting empty query values.
 *
 * @param baseUrl - API origin, with or without a trailing slash.
 * @param path - Absolute path on that origin, starting with `/`.
 * @param query - Query parameters. Null, undefined, and empty strings are dropped.
 * @returns The URL string.
 */
export function buildGatewayUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string | null | undefined>,
): string {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/**
 * Reads a response body, parsing JSON when the payload is JSON.
 *
 * @param response - The fetch response.
 * @returns The parsed JSON value, the raw text, or null when the body is empty.
 */
export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const looksLikeJson = contentType.includes("json") || text.trim().startsWith("{");
  if (!looksLikeJson) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Decodes a base64 JSON header value.
 *
 * @param value - The header value.
 * @returns The parsed JSON value.
 */
function decodeBase64Json(value: string): unknown {
  const json = Buffer.from(value.trim(), "base64").toString("utf8");
  return JSON.parse(json) as unknown;
}

/**
 * Normalizes an `accepts` array into quoted payment options.
 *
 * @param value - A PaymentRequired object, or anything else.
 * @returns The options, an empty list when `accepts` is empty, or null when the shape is missing.
 */
function asQuotedPayments(value: unknown): QuotedPayment[] | null {
  if (!value || typeof value !== "object" || !("accepts" in value)) {
    return null;
  }

  const accepts = (value as { accepts?: unknown }).accepts;
  if (!Array.isArray(accepts)) {
    return null;
  }

  const options: QuotedPayment[] = [];
  for (const entry of accepts) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.network !== "string" || typeof record.asset !== "string") {
      continue;
    }
    options.push({
      network: record.network,
      asset: record.asset,
      amount: typeof record.amount === "string" ? record.amount : undefined,
      maxAmountRequired:
        typeof record.maxAmountRequired === "string" ? record.maxAmountRequired : undefined,
    });
  }
  return options;
}

/**
 * Reads payment options from a 402 response.
 * The v2 `PAYMENT-REQUIRED` header wins. The JSON body is the fallback.
 *
 * @param response - The unpaid 402 response.
 * @param body - The already-parsed response body.
 * @returns Quoted options, or null when neither the header nor the body could be read.
 */
export function readQuotedPayments(response: Response, body: unknown): QuotedPayment[] | null {
  const header = response.headers.get("payment-required");
  if (header) {
    try {
      const parsed = asQuotedPayments(decodeBase64Json(header));
      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall through to the JSON body when the header is not base64 JSON.
    }
  }
  return asQuotedPayments(body);
}

/**
 * Returns the atomic USDC amount, accepting the v2 `amount` field and the v1 name.
 *
 * @param option - A quoted payment option.
 * @returns A digit string, or undefined when the amount is missing or not atomic units.
 */
export function atomicPaymentAmount(option: QuotedPayment): string | undefined {
  const candidate = option.amount ?? option.maxAmountRequired;
  if (candidate && /^\d+$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}

/**
 * Selects the first USDC option on the wallet's network and applies the per-call cap.
 * This does not sign. Callers must refuse when `ok` is false before creating a signer.
 *
 * Non-USDC options in the same 402 (the live API also offers XRP) are ignored.
 * The option that would be paid has to be USDC. If it is not, the selection fails.
 *
 * @param options - Payment options from the 402 quote.
 * @param walletProvider - The wallet that would pay.
 * @param maxPaymentUsdc - Cap in whole USDC units.
 * @returns The atomic amount to pay, or a refusal that must be returned before signing.
 */
export function selectUsdcPayment(
  options: QuotedPayment[],
  walletProvider: EvmWalletProvider,
  maxPaymentUsdc: number,
): UsdcPaymentSelection {
  const walletNetworks = getX402Networks(walletProvider.getNetwork());
  const usdcOptions = options.filter(
    option => walletNetworks.includes(option.network) && isUsdcAsset(option.asset, walletProvider),
  );

  if (usdcOptions.length === 0) {
    return {
      ok: false,
      message: "Only USDC payments are supported",
      details:
        "No USDC payment option for this wallet's network is available. This provider pays only USDC on Base.",
    };
  }

  const amount = atomicPaymentAmount(usdcOptions[0]);
  if (!amount) {
    return {
      ok: false,
      message: "Unreadable payment amount",
      details:
        "The USDC payment option did not include an atomic amount, so no payment was signed.",
    };
  }

  let validation: ReturnType<typeof validatePaymentLimit>;
  try {
    validation = validatePaymentLimit(amount, maxPaymentUsdc);
  } catch {
    return {
      ok: false,
      message: "Unreadable payment amount",
      details:
        "The USDC payment amount could not be checked against the cap, so no payment was signed.",
    };
  }

  if (!validation.isValid) {
    return {
      ok: false,
      message: "Payment exceeds limit",
      details: `The requested payment of ${validation.requestedAmount} USDC exceeds the maximum spending limit of ${validation.maxAmount} USDC.`,
      maxPaymentUsdc,
    };
  }

  return { ok: true, amount };
}

/**
 * Reads the settlement transaction hash from `PAYMENT-RESPONSE` (v2) or `X-PAYMENT-RESPONSE` (v1).
 *
 * @param response - The paid response.
 * @returns The transaction hash, or null when the header is missing or has no hash.
 */
export function paymentTxHashFromResponse(response: Response): string | null {
  const header =
    response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
  if (!header) {
    return null;
  }

  try {
    const decoded = decodeBase64Json(header) as { transaction?: unknown; txHash?: unknown };
    const hash = decoded.transaction ?? decoded.txHash;
    return typeof hash === "string" && hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

/**
 * JSON error string returned to the agent.
 *
 * @param message - Short error code the agent can branch on.
 * @param details - Human-readable explanation.
 * @param extra - Additional fields, such as the configured cap.
 * @returns A JSON string.
 */
export function jsonError(
  message: string,
  details: string,
  extra?: Record<string, unknown>,
): string {
  return JSON.stringify({
    error: true,
    message,
    details,
    ...extra,
  });
}
