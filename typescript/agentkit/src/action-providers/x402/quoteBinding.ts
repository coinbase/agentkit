/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-description, jsdoc/require-returns, jsdoc/require-param-description, jsdoc/require-param, @typescript-eslint/member-ordering */
/** One-use frozen quote approvals expire after 60 seconds. */
export const QUOTE_BINDING_TTL_MS = 60_000;

/** At most 8 unused frozen quote approvals are retained; oldest is evicted. */
export const QUOTE_BINDING_MAX_PENDING = 8;

export interface FrozenRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyBytes: string | null;
}

export type FrozenRequirement = {
  [key: string]: unknown;
  scheme: string;
  network: string;
  asset: string;
};

export interface FrozenApproval {
  handle: string;
  createdAtMs: number;
  expiresAtMs: number;
  request: FrozenRequest;
  paymentRequiredEnvelope: Record<string, unknown>;
  selectedRequirement: FrozenRequirement;
}

export type ConsumeFailure = { ok: false; message: string; details: string };
export type ConsumeSuccess = { ok: true; value: FrozenApproval };

/**
 *
 * @param headers
 */
export function canonicalizeHeaders(
  headers?: Record<string, string> | null,
): Record<string, string> {
  if (!headers) {
    return {};
  }
  const out: Record<string, string> = {};
  const keys = Object.keys(headers).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  for (const key of keys) {
    out[key.toLowerCase()] = headers[key];
  }
  return out;
}

/**
 *
 * @param args
 * @param args.method
 * @param args.url
 * @param args.headers
 * @param args.bodyBytes
 */
export function canonicalizeRequest(args: {
  method: string;
  url: string;
  headers?: Record<string, string> | null;
  bodyBytes?: string | null;
}): FrozenRequest {
  return {
    method: args.method,
    url: args.url,
    headers: canonicalizeHeaders(args.headers),
    bodyBytes: args.bodyBytes ?? null,
  };
}

/**
 *
 * @param value
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

/**
 *
 * @param value
 */
function normalizeComparable(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value.toLowerCase();
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeComparable(item));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = normalizeComparable(obj[key]);
    }
    return out;
  }
  return value;
}

/**
 *
 * @param left
 * @param right
 */
export function requirementsEqual(left: unknown, right: unknown): boolean {
  return stableStringify(normalizeComparable(left)) === stableStringify(normalizeComparable(right));
}

/**
 *
 * @param later
 * @param frozen
 */
export function envelopeSigningFieldsEqual(later: unknown, frozen: unknown): boolean {
  const laterObj = asRecord(later);
  const frozenObj = asRecord(frozen);
  if (!laterObj || !frozenObj) {
    return false;
  }
  if (laterObj.x402Version !== frozenObj.x402Version) {
    return false;
  }
  if (
    stableStringify(normalizeComparable(laterObj.resource)) !==
    stableStringify(normalizeComparable(frozenObj.resource))
  ) {
    return false;
  }
  if (
    stableStringify(normalizeComparable(laterObj.extensions ?? null)) !==
    stableStringify(normalizeComparable(frozenObj.extensions ?? null))
  ) {
    return false;
  }
  return true;
}

/**
 *
 * @param value
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export type SelectedOptionFields = {
  scheme?: string | null;
  network?: string | null;
  asset?: string | null;
  maxAmountRequired?: string | null;
  amount?: string | null;
  price?: string | null;
  payTo?: string | null;
  maxTimeoutSeconds?: number | null;
  resource?: string | null;
  extra?: Record<string, unknown> | null;
};

/**
 *
 * @param selected
 * @param frozen
 */
export function selectedOptionConflicts(
  selected: SelectedOptionFields,
  frozen: FrozenRequirement,
): boolean {
  if (selected.scheme && selected.scheme !== frozen.scheme) {
    return true;
  }
  if (selected.network && selected.network !== frozen.network) {
    return true;
  }
  if (selected.asset && String(frozen.asset).toLowerCase() !== selected.asset.toLowerCase()) {
    return true;
  }
  const selectedAmount = selected.maxAmountRequired ?? selected.amount ?? selected.price;
  const frozenAmount =
    (typeof frozen.maxAmountRequired === "string" ? frozen.maxAmountRequired : undefined) ??
    (typeof frozen.amount === "string" ? frozen.amount : undefined) ??
    (typeof frozen.price === "string" ? frozen.price : undefined);
  if (selectedAmount && frozenAmount && selectedAmount !== frozenAmount) {
    return true;
  }
  if (selected.payTo && typeof frozen.payTo === "string") {
    if (selected.payTo.toLowerCase() !== frozen.payTo.toLowerCase()) {
      return true;
    }
  }
  if (
    selected.maxTimeoutSeconds != null &&
    selected.maxTimeoutSeconds !== frozen.maxTimeoutSeconds
  ) {
    return true;
  }
  if (selected.resource != null && selected.resource !== frozen.resource) {
    return true;
  }
  if (selected.extra && typeof selected.extra === "object") {
    if (
      stableStringify(normalizeComparable(selected.extra)) !==
      stableStringify(normalizeComparable(frozen.extra ?? {}))
    ) {
      return true;
    }
  }
  return false;
}

/**
 *
 * @param frozen
 */
export function createFrozenSelector(frozen: FrozenRequirement) {
  return (_x402Version: number, paymentRequirements: unknown[]) => {
    const matches = paymentRequirements.filter(requirement =>
      requirementsEqual(requirement, frozen),
    );
    if (matches.length === 0) {
      throw new Error(
        "Frozen payment requirement not present in later 402; refusing drifted quote",
      );
    }
    if (matches.length !== 1) {
      throw new Error(
        "Frozen payment requirement is ambiguous; exact-one match required before sign",
      );
    }
    return matches[0];
  };
}

/**
 *
 * @param approval
 */
export function createFrozenBeforePaymentHook(approval: FrozenApproval) {
  return async (context: {
    paymentRequired: unknown;
    selectedRequirements: unknown;
  }): Promise<void | { abort: true; reason: string }> => {
    if (!requirementsEqual(context.selectedRequirements, approval.selectedRequirement)) {
      return { abort: true, reason: "selected payment requirement drifted from frozen quote" };
    }
    if (!envelopeSigningFieldsEqual(context.paymentRequired, approval.paymentRequiredEnvelope)) {
      return { abort: true, reason: "payment-required envelope drifted from frozen quote" };
    }
    return;
  };
}

/**
 *
 * @param left
 * @param right
 */
export function requestsEqual(left: FrozenRequest, right: FrozenRequest): boolean {
  return stableStringify(left) === stableStringify(right);
}

/**
 *
 */
function createHandle(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/**
 *
 * @param frozen
 */
export function frozenPaymentUsed(frozen: FrozenRequirement): {
  network: string;
  asset: string;
  amount: string | undefined;
} {
  const amount =
    (typeof frozen.maxAmountRequired === "string" ? frozen.maxAmountRequired : undefined) ??
    (typeof frozen.amount === "string" ? frozen.amount : undefined) ??
    (typeof frozen.price === "string" ? frozen.price : undefined);
  return {
    network: frozen.network,
    asset: frozen.asset,
    amount,
  };
}

/**
 *
 */
export class QuoteBindingStore {
  private readonly pending = new Map<string, FrozenApproval>();

  /**
   *
   * @param approval
   * @param nowMs
   */
  create(approval: Omit<FrozenApproval, "handle">, nowMs: number = Date.now()): string {
    this.evictExpired(nowMs);
    while (this.pending.size >= QUOTE_BINDING_MAX_PENDING) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.pending.delete(oldest);
    }
    const handle = createHandle();
    this.pending.set(handle, { ...approval, handle });
    return handle;
  }

  /**
   *
   * @param args
   * @param args.handle
   * @param args.request
   * @param args.selectedPaymentOption
   * @param args.extensions
   * @param args.nowMs
   */
  consume(args: {
    handle?: string | null;
    request: FrozenRequest;
    selectedPaymentOption: SelectedOptionFields;
    extensions?: Record<string, unknown> | null;
    nowMs: number;
  }): ConsumeSuccess | ConsumeFailure {
    this.evictExpired(args.nowMs);

    if (args.handle == null || args.handle === "") {
      return {
        ok: false,
        message: "No valid frozen quote binding",
        details:
          "retry_http_request_with_x402 requires a quoteBinding from make_http_request. Caller-supplied payment fields are not payment authority.",
      };
    }
    if (
      typeof args.handle !== "string" ||
      args.handle.length < 8 ||
      !/^[0-9a-fA-F]+$/.test(args.handle)
    ) {
      return {
        ok: false,
        message: "Malformed quote binding",
        details: "quoteBinding is missing or malformed; signer will not be invoked.",
      };
    }
    const approval = this.pending.get(args.handle);
    if (!approval) {
      return {
        ok: false,
        message: "Quote binding not found",
        details:
          "No unused frozen quote matches this quoteBinding. The handle may be expired, evicted, already used, or never issued.",
      };
    }

    if (approval.expiresAtMs <= args.nowMs) {
      this.pending.delete(approval.handle);
      return {
        ok: false,
        message: "Quote binding expired",
        details: `Frozen quote approvals expire after ${QUOTE_BINDING_TTL_MS}ms.`,
      };
    }

    if (!requestsEqual(approval.request, args.request)) {
      return {
        ok: false,
        message: "Request does not match frozen quote",
        details:
          "The retry method, URL, headers, query, or body bytes differ from the inspected unpaid request.",
      };
    }

    if (selectedOptionConflicts(args.selectedPaymentOption, approval.selectedRequirement)) {
      return {
        ok: false,
        message: "Selected payment option does not match frozen quote",
        details:
          "The selected option cannot authorize a different (including more expensive) requirement than the one frozen on inspect.",
      };
    }

    if (args.extensions != null) {
      const frozenExtensions = approval.paymentRequiredEnvelope.extensions ?? {};
      if (
        stableStringify(normalizeComparable(args.extensions)) !==
        stableStringify(normalizeComparable(frozenExtensions))
      ) {
        return {
          ok: false,
          message: "Selected payment option does not match frozen quote",
          details: "Envelope extensions differ from the frozen inspected quote.",
        };
      }
    }

    this.pending.delete(approval.handle);
    return { ok: true, value: approval };
  }

  /**
   *
   * @param nowMs
   */
  private evictExpired(nowMs: number): void {
    for (const [handle, approval] of this.pending) {
      if (approval.expiresAtMs <= nowMs) {
        this.pending.delete(handle);
      }
    }
  }
}

/** Bitcoin-alphabet Base58 (no 0/O/I/l). SVM signatures are case-sensitive. */
const BITCOIN_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 *
 * @param network
 */
export function settlementFamily(network: string): "evm" | "svm" | null {
  const normalized = network.toLowerCase();
  if (normalized.startsWith("solana")) {
    return "svm";
  }
  if (normalized.startsWith("base") || normalized.startsWith("eip155:")) {
    return "evm";
  }
  return null;
}

/**
 *
 * @param value
 */
function decodeBitcoinBase58(value: string): Uint8Array | null {
  let num = 0n;
  for (const ch of value) {
    const idx = BITCOIN_BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) {
      return null;
    }
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.push(Number(num % 256n));
    num = num / 256n;
  }
  bytes.reverse();
  let leading = 0;
  for (const ch of value) {
    if (ch === "1") {
      leading += 1;
    } else {
      break;
    }
  }
  return new Uint8Array(leading + bytes.length).map((_, i) =>
    i < leading ? 0 : bytes[i - leading],
  );
}

/**
 *
 * @param transaction
 */
function isWellFormedSvmSignature(transaction: string): boolean {
  if (transaction.length < 86 || transaction.length > 88) {
    return false;
  }
  for (const ch of transaction) {
    if (!BITCOIN_BASE58_ALPHABET.includes(ch)) {
      return false;
    }
  }
  const decoded = decodeBitcoinBase58(transaction);
  return decoded !== null && decoded.length === 64;
}

/**
 *
 * @param network
 * @param transaction
 */
export function isWellFormedSettlementTransaction(network: string, transaction: string): boolean {
  const family = settlementFamily(network);
  if (family === "evm") {
    return /^0x[0-9a-fA-F]{64}$/.test(transaction);
  }
  if (family === "svm") {
    return isWellFormedSvmSignature(transaction);
  }
  return false;
}

/**
 *
 * @param network
 * @param proofPayer
 * @param walletAddress
 */
export function settlementPayersEqual(
  network: string,
  proofPayer: string,
  walletAddress: string,
): boolean {
  const family = settlementFamily(network);
  if (family === "evm") {
    return proofPayer.toLowerCase() === walletAddress.toLowerCase();
  }
  if (family === "svm") {
    return proofPayer === walletAddress;
  }
  return false;
}
