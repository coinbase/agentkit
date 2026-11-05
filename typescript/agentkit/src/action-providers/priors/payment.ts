// One signature per purchase: the payer rules of Priors' own x402 client (@priors/x402's payer, and @priors/mcp's
// pay_url on it), ported for this provider and the @x402 client it runs on.
//   - A purchase is the wallet, the method, the URL as the seller reads it and the body (purchaseKey).
//   - Its payment is signed once and kept before it is sent; while it may still settle, a call for the same purchase
//     sends that same payment again (resend), never a new one.
//   - Once the payment may be out, no error loses it: a dropped connection or no answer in time is an answer
//     ("pending"), never a throw.
//   - The authorization is valid at most MAX_VALIDITY_SECONDS, whatever maxTimeoutSeconds the seller names, so a
//     payment that was sent and not seen settled stops being cashable soon.
import { sha256, toBytes } from "viem";
import { decodePaymentResponseHeader, x402Client } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ROBINHOOD_NETWORK, USDG } from "./constants";

/** The longest an authorization this provider signs stays cashable, in seconds. */
export const MAX_VALIDITY_SECONDS = 600;
/** Seconds a payment is kept past its validBefore, for clock skew between this machine and the chain. */
export const SKEW_SECONDS = 60;
/**
 * A request's timeout, in ms: the probe's (past it nothing is paid), and a paid one's (past it the payment is pending,
 * not lost).
 */
export const REQUEST_TIMEOUT_MS = 60_000;
/** A seller's body is read at most this far: a seller that streams gigabytes cannot exhaust the process's memory. */
export const MAX_BODY_BYTES = 256 * 1024;
/** USDG's EIP-712 domain on Robinhood Chain: what an EIP-3009 TransferWithAuthorization is signed on. */
export const USDG_DOMAIN = { name: "Global Dollar", version: "1" } as const;
/** The `extra.paymentFlow` values x402's client signs (none at all is "authorization"). */
const PAYMENT_FLOWS = new Set(["authorization", "upfront", "escrow"]);

/** What a payment sent answered. */
export type Sent = {
  response: Response;
  pending: boolean;
  timedOut?: boolean;
  transportError?: boolean;
  error?: unknown;
};

const sameAddress = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();
/**
 * Whether an error is a request's abort or its timeout.
 *
 * @param e - The error.
 * @returns Whether it is one.
 */
export const isAbort = (e: unknown) =>
  (e as { name?: string })?.name === "AbortError" ||
  (e as { name?: string })?.name === "TimeoutError";
const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * A response body as text, at most `max` bytes (UTF-8); the rest is cancelled, not read. A body that breaks off while
 * it is read (a reset, the request's timeout) throws.
 *
 * @param response - The response.
 * @param max - The most bytes read.
 * @returns The text, and whether it was cut.
 */
export async function readCapped(
  response: Response,
  max = MAX_BODY_BYTES,
): Promise<{ text: string; cut: boolean }> {
  if (!response.body) return { text: "", cut: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.byteLength > max) {
      chunks.push(value.subarray(0, max - n));
      n = max;
      cut = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    n += value.byteLength;
  }
  const buf = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.byteLength;
  }
  return { text: new TextDecoder().decode(buf), cut };
}

/**
 * The first requirement this provider signs: x402 v2 `exact` for USDG on Robinhood Chain by its full address, by
 * EIP-3009, an integer amount, a 0x payTo, no `paymentFlow` x402's client does not sign, and no EIP-712 domain but
 * USDG's own (a requirement naming none is signed on it).
 *
 * @param accepts - The 402's `accepts`.
 * @returns The requirement, or null.
 */
export function pickUsdgRequirement(accepts: unknown): PaymentRequirements | null {
  const list = Array.isArray(accepts) ? (accepts as Array<Record<string, unknown> | null>) : [];
  const found = list.find(x => {
    const extra = (x?.extra ?? {}) as Record<string, unknown>;
    return (
      !!x &&
      x.scheme === "exact" &&
      x.network === ROBINHOOD_NETWORK &&
      sameAddress(x.asset, USDG) &&
      /^\d+$/.test(String(x.amount)) &&
      /^0x[0-9a-fA-F]{40}$/.test(String(x.payTo)) &&
      (!extra.assetTransferMethod || extra.assetTransferMethod === "eip3009") &&
      (extra.paymentFlow == null || PAYMENT_FLOWS.has(String(extra.paymentFlow))) &&
      (!extra.name || extra.name === USDG_DOMAIN.name) &&
      (!extra.version || extra.version === USDG_DOMAIN.version)
    );
  });
  return (found as unknown as PaymentRequirements) ?? null;
}

/**
 * `ExactEvmScheme` for USDG that never signs an authorization valid for more than MAX_VALIDITY_SECONDS, whatever
 * `maxTimeoutSeconds` the 402 names, and signs a requirement that names no EIP-712 domain on USDG's own. The payload's
 * `accepted` stays the seller's requirement as written.
 */
export class CappedExactEvmScheme {
  readonly scheme = "exact";
  private readonly inner: ExactEvmScheme;

  /**
   * Builds the scheme.
   *
   * @param signer - The wallet's signer (an AgentKit EvmWalletProvider's toSigner()).
   */
  constructor(signer: ConstructorParameters<typeof ExactEvmScheme>[0]) {
    this.inner = new ExactEvmScheme(signer);
  }

  /**
   * Signs the requirement with its window capped.
   *
   * @param x402Version - The x402 version.
   * @param requirements - The requirement.
   * @param context - What x402's client passes on (its spend cap, extensions).
   * @returns The payment payload.
   */
  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
    context?: unknown,
  ): Promise<Awaited<ReturnType<ExactEvmScheme["createPaymentPayload"]>>> {
    const extra = { ...((requirements.extra ?? {}) as Record<string, unknown>) };
    if (extra.assetTransferMethod && extra.assetTransferMethod !== "eip3009")
      throw new Error("only EIP-3009 authorizations are signed for USDG");
    if (!extra.name) extra.name = USDG_DOMAIN.name;
    if (!extra.version) extra.version = USDG_DOMAIN.version;
    const asked = Number(requirements.maxTimeoutSeconds);
    const window =
      Number.isSafeInteger(asked) && asked > 0 ? Math.min(asked, MAX_VALIDITY_SECONDS) : 60;
    const signed = { ...requirements, maxTimeoutSeconds: window, extra };
    const sign = this.inner.createPaymentPayload.bind(this.inner) as (
      v: number,
      r: PaymentRequirements,
      c?: unknown,
    ) => ReturnType<ExactEvmScheme["createPaymentPayload"]>;
    return sign(x402Version, signed, context);
  }
}

/**
 * The x402 client that signs one payment: USDG on Robinhood Chain only, at most `price`, by the capped scheme.
 * `@x402/core` 2.23 and later also refuse every asset their spend controls do not list (USDG on Robinhood Chain is
 * not one of their defaults): there it is listed, with `price` as its cap.
 *
 * @param signer - The wallet's signer.
 * @param price - The most it may sign, atomic USDG.
 * @returns The client.
 */
export function usdgClient(
  signer: ConstructorParameters<typeof ExactEvmScheme>[0],
  price: bigint,
): x402Client {
  const client = new x402Client().register(ROBINHOOD_NETWORK, new CappedExactEvmScheme(signer));
  const controls = client as unknown as { setSpendControls?: (c: unknown) => unknown };
  if (typeof controls.setSpendControls === "function")
    controls.setSpendControls({
      allowedAssets: [
        { network: ROBINHOOD_NETWORK, asset: USDG, maxAmountPerPayment: price.toString() },
      ],
    });
  return client.registerPolicy((_version, reqs) =>
    reqs.filter(
      r =>
        r.scheme === "exact" &&
        r.network === ROBINHOOD_NETWORK &&
        sameAddress(r.asset, USDG) &&
        /^\d+$/.test(String(r.amount)) &&
        BigInt(String(r.amount)) <= price,
    ),
  );
}

/**
 * A URL as the seller reads it: the fragment and a trailing dot of the host dropped, path escapes of unreserved
 * characters decoded and the others in upper case (RFC 3986 6.2.2), the query as form fields sorted by name and an
 * empty "?" dropped.
 *
 * @param url - The URL.
 * @returns Its one spelling.
 */
function purchaseUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  if (u.hostname.endsWith(".")) u.hostname = u.hostname.slice(0, -1);
  u.pathname = u.pathname.replace(/%[0-9a-fA-F]{2}/g, m => {
    const ch = String.fromCharCode(parseInt(m.slice(1), 16));
    return /[A-Za-z0-9._~-]/.test(ch) ? ch : m.toUpperCase();
  });
  if (u.search) u.searchParams.sort();
  else u.search = "";
  return u.href;
}

/**
 * A JSON number by its value, every digit kept: one a double holds exactly as JSON.stringify writes it, any other as
 * its significant digits and power of ten.
 *
 * @param n - The number as written.
 * @returns Its one spelling.
 */
function canonicalNumber(n: string): string {
  const [, sign, int, frac = "", exp = "0"] = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(
    n,
  ) as RegExpExecArray;
  const all = int + frac;
  const trimmed = all.replace(/0+$/, "");
  const digits = trimmed.replace(/^0+/, "");
  if (digits === "") return "0";
  const x = Math.abs(Number(n));
  if (digits.length <= 15 && x >= 1e-300 && x < Infinity) return JSON.stringify(Number(n));
  return `${sign}${digits}e${BigInt(exp) - BigInt(frac.length) + BigInt(all.length - trimmed.length)}`;
}

/**
 * A valid JSON text with sorted keys, no whitespace and one spelling per string and number, read from the text itself
 * (not JSON.parse's doubles): two bodies that are the same JSON value are the same purchase. An explicit stack and a
 * character scan, no recursion, so no valid body is too deep for it.
 *
 * @param text - A valid JSON text.
 * @returns Its one spelling.
 */
function canonicalJson(text: string): string {
  const n = text.length;
  let i = 0;
  const ws = () => {
    while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r"))
      i++;
  };
  const str = (): string => {
    const s = i++;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
    return JSON.parse(text.slice(s, i));
  };
  type Open = { obj?: Map<string, string>; key?: string; arr?: string[] };
  const stack: Open[] = [];
  for (;;) {
    ws();
    let v: string;
    const c = text[i];
    if (c === "{") {
      i++;
      ws();
      if (text[i] === "}") {
        i++;
        v = "{}";
      } else {
        const key = str();
        ws();
        i++;
        stack.push({ obj: new Map(), key });
        continue;
      }
    } else if (c === "[") {
      i++;
      ws();
      if (text[i] === "]") {
        i++;
        v = "[]";
      } else {
        stack.push({ arr: [] });
        continue;
      }
    } else if (c === '"') v = JSON.stringify(str());
    else if (c === "-" || (c >= "0" && c <= "9")) {
      const s = i;
      while (i < n && "+-.eE0123456789".includes(text[i])) i++;
      v = canonicalNumber(text.slice(s, i));
    } else {
      v = text.startsWith("true", i) ? "true" : text.startsWith("false", i) ? "false" : "null";
      i += v.length;
    }
    // the value goes into its container; every container the next character closes becomes a value in turn
    for (;;) {
      const top = stack[stack.length - 1];
      if (!top) return v;
      if (top.arr) top.arr.push(v);
      else (top.obj as Map<string, string>).set(top.key as string, v);
      ws();
      if (text[i++] === ",") {
        if (top.obj) {
          ws();
          top.key = str();
          ws();
          i++;
        }
        break;
      }
      stack.pop();
      v = top.arr
        ? `[${top.arr.join(",")}]`
        : `{${[...(top.obj as Map<string, string>).keys()]
            .sort()
            .map(k => `${JSON.stringify(k)}:${(top.obj as Map<string, string>).get(k)}`)
            .join(",")}}`;
    }
  }
}

/**
 * A purchase's identity: the method, the URL as the seller reads it, and the body (the bodies this provider sends: a
 * JSON one by its value, so key order and whitespace do not make a second purchase; any other by its bytes), as a
 * SHA-256.
 *
 * @param req - The request.
 * @returns The purchase's key.
 */
export async function purchaseKey(req: Request): Promise<string> {
  const head = `${req.method} ${purchaseUrl(req.url)}`;
  const bytes = req.body ? new Uint8Array(await req.clone().arrayBuffer()) : new Uint8Array(0);
  if (bytes.length === 0) return head;
  let canon: string | null = null;
  if (/json/i.test(req.headers.get("content-type") || "")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      JSON.parse(text);
      canon = "json:" + canonicalJson(text);
    } catch {
      canon = null; // not JSON: by its bytes
    }
  }
  const raw = new Uint8Array([...toBytes("raw:"), ...bytes]);
  const digest = sha256(canon !== null ? toBytes(canon) : raw);
  return `${head} body:${digest.slice(2)}`;
}

/**
 * Whether a response says "your payment was broadcast, not confirmed yet: send the same one again" (x402 v2
 * `settlement_pending`, or a `{ pending: true }` body).
 *
 * @param response - The response.
 * @returns Whether it is pending.
 */
async function isPending(response: Response): Promise<boolean> {
  if (response.status !== 402) return false;
  for (const name of ["PAYMENT-RESPONSE", "X-PAYMENT-RESPONSE"]) {
    const h = response.headers.get(name);
    if (!h) continue;
    try {
      const settle = decodePaymentResponseHeader(h) as { errorReason?: string };
      if (settle?.errorReason === "settlement_pending") return true;
    } catch {
      // not a settlement response
    }
  }
  try {
    const text = (await response.clone().text()).slice(0, 64 * 1024);
    const b = JSON.parse(text);
    return b?.pending === true || b?.errorReason === "settlement_pending";
  } catch {
    return false;
  }
}

/**
 * Sends an already-signed payment, and sends the same one again while the seller answers 402 pending. Never signs
 * anything, and once the payment may be out never throws: no answer in time is pending (`timedOut`, a 504), any other
 * transport error (a reset, a dropped connection) pending too (`transportError`, a 502): the seller may have read the
 * payment and may still settle it, so it must never be signed again.
 *
 * @param input - The URL.
 * @param paymentHeaders - The signed payment's headers.
 * @param options - The request's init, the fetch to send it with, how often to send it again while pending, the wait
 * between two sends, and the timeout of each.
 * @param options.init - The request's method, headers and body (its redirect is "manual" unless it says otherwise).
 * @param options.fetchImpl - The fetch to send it with.
 * @param options.retries - How often to send it again while the seller answers pending.
 * @param options.maxSleepMs - The longest wait between two sends.
 * @param options.timeoutMs - Each send's timeout (0: none).
 * @param options.sleep - The wait (injectable for tests).
 * @returns What the seller answered.
 */
export async function resend(
  input: string,
  paymentHeaders: Record<string, string>,
  {
    init,
    fetchImpl,
    retries = 2,
    maxSleepMs = 10_000,
    timeoutMs = REQUEST_TIMEOUT_MS,
    sleep = defaultSleep,
  }: {
    init: RequestInit;
    fetchImpl: typeof fetch;
    retries?: number;
    maxSleepMs?: number;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<Sent> {
  const base = new Request(input, { ...init, redirect: init.redirect ?? "manual" });
  const send = () => {
    const r = base.clone();
    for (const [k, v] of Object.entries(paymentHeaders)) r.headers.set(k, v);
    r.headers.set("Access-Control-Expose-Headers", "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE");
    return fetchImpl(
      timeoutMs > 0 ? new Request(r, { signal: AbortSignal.timeout(timeoutMs) }) : r,
    );
  };
  let response: Response;
  try {
    response = await send();
    for (let i = 0; i < retries && (await isPending(response)); i++) {
      const after = Number(response.headers.get("retry-after"));
      await sleep(
        Math.min(
          maxSleepMs,
          1000 * Math.min(30, Math.max(1, Number.isFinite(after) && after > 0 ? after : 5)),
        ),
      );
      response = await send();
    }
  } catch (error) {
    if (isAbort(error))
      return {
        response: new Response(null, { status: 504, statusText: "payer timeout" }),
        pending: true,
        timedOut: true,
      };
    return {
      response: new Response(null, { status: 502, statusText: "payer transport error" }),
      pending: true,
      transportError: true,
      error,
    };
  }
  return { response, pending: await isPending(response) };
}
