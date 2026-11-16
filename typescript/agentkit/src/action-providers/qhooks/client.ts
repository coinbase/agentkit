import { validateTradePlan } from "./trade-plan";
// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { DEFINITIONS, type ToolName } from "./definitions";
export interface QHooksOptions {
  referrer?: string;
  transport?: "mcp" | "rest";
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}
/** Safe transport/control metadata without interpolating untrusted response bodies. */
export class QHooksError extends Error {
  /**
   * Create a QHooks control error.
   *
   * @param code - Stable client error code.
   * @param message - Safe explanatory text.
   * @param status - Optional HTTP status.
   * @param retryAfterSeconds - Optional bounded retry guidance.
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "QHooksError";
  }
}
const ROUTE: Record<ToolName, string> = {
  otc_quote: "otc-quote",
  otc_create: "otc-create",
  otc_accept: "otc-accept",
  deal_status: "deal-status",
  agreement_create: "agreement-create",
  agreement_fund: "agreement-fund",
  agreement_from_template: "agreement-from-template",
  agreement_status: "agreement-status",
  agreement_release: "agreement-release",
  agreement_refund: "agreement-refund",
  agreement_attest: "agreement-attest",
  qproof_check: "qproof-check",
  wallet_portfolio: "wallet-portfolio",
  hooks_catalog: "hooks-catalog",
  agent_stats: "agent-stats",
  list_callers: "list-callers",
  caller_record: "caller-record",
  perps_markets: "perps-markets",
  perps_positions: "perps-positions",
  prepare_perps_order: "prepare-perps-order",
  list_launches: "launches",
  token_info: "token",
  quote: "quote",
  prepare_launch: "prepare-launch",
  prepare_trade: "prepare-trade",
};
const ORIGIN = "https://qhooks.com",
  MAX_BODY = 2 * 1024 * 1024;
const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const evm = (v: string) => /^0x[0-9a-f]{40}$/i.test(v) && BigInt(v) !== 0n;
// These schemas are pinned build inputs, never descriptions/instructions returned by a remote MCP server.
type PinnedSchema = {
  type?: string;
  properties?: Record<string, PinnedSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: PinnedSchema;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  enum?: readonly unknown[];
  const?: unknown;
  description?: string;
};
/**
 * Convert the supported pinned schema subset into a local validator.
 *
 * @param p - Reviewed schema fragment.
 * @param depth - Current bounded nesting depth.
 * @returns The matching Zod validator.
 */
function schemaValue(p: PinnedSchema, depth = 0): z.ZodTypeAny {
  if (depth > 16) throw Error("Pinned schema nesting exceeds the adapter limit");
  const supported = new Set([
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "enum",
    "const",
    "description",
  ]);
  if (Object.keys(p).some(k => !supported.has(k))) throw Error("Unsupported pinned schema keyword");
  let type: z.ZodTypeAny;
  if (p.type === "string") {
    let s = z.string();
    if (p.minLength !== undefined) s = s.min(p.minLength);
    if (p.maxLength !== undefined) s = s.max(p.maxLength);
    if (p.pattern) s = s.regex(new RegExp(p.pattern));
    type = s;
  } else if (p.type === "integer" || p.type === "number") {
    let n = p.type === "integer" ? z.number().int().safe() : z.number().finite();
    if (p.minimum !== undefined) n = n.min(p.minimum);
    if (p.maximum !== undefined) n = n.max(p.maximum);
    type = n;
  } else if (p.type === "boolean") type = z.boolean();
  else if (p.type === "array") {
    if (!p.items) throw Error("Pinned array schema requires items");
    let a = z.array(schemaValue(p.items, depth + 1));
    if (p.minItems !== undefined) a = a.min(p.minItems);
    if (p.maxItems !== undefined) a = a.max(p.maxItems);
    type = a;
  } else if (p.type === "object") {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [name, field] of Object.entries(p.properties || {})) {
      const value = schemaValue(field, depth + 1);
      shape[name] = p.required?.includes(name) ? value : value.optional();
    }
    const o = z.object(shape);
    type = p.additionalProperties === false ? o.strict() : o.passthrough();
  } else throw Error("Unsupported pinned schema type");
  if (p.enum) type = type.refine(v => p.enum!.includes(v), "Invalid choice");
  if (hasOwn(p, "const")) type = type.refine(v => Object.is(v, p.const), "Unexpected value");
  return type;
}
/**
 * Build a validator for one pinned tool.
 *
 * @param def - Reviewed tool definition.
 * @returns The tool input validator.
 */
function schemaOf(def: (typeof DEFINITIONS)[number]): z.ZodTypeAny {
  return schemaValue(def.inputSchema as PinnedSchema);
}
export const SCHEMAS = Object.freeze(
  Object.fromEntries(DEFINITIONS.map(d => [d.name, schemaOf(d)])) as Record<ToolName, z.ZodType>,
);
/**
 * Compare structured/text MCP data without depending on object-key order.
 *
 * @param a - First JSON value.
 * @param b - Second JSON value.
 * @param depth - Current bounded nesting depth.
 * @returns Whether both values contain identical data.
 */
function sameJson(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth > 64) throw new QHooksError("invalid_response", "QHooks result is nested too deeply.");
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameJson(v, b[i], depth + 1))
    );
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(k => hasOwn(b, k) && sameJson(a[k], b[k], depth + 1))
  );
}
const retryAfter = (s: string | null) => {
  if (!s) return undefined;
  const n = /^[0-9]+$/.test(s) ? Number(s) : Math.ceil((Date.parse(s) - Date.now()) / 1000);
  return Number.isFinite(n) ? Math.max(0, Math.min(86400, n)) : undefined;
};
/**
 * Decode bounded JSON while canceling an oversized response.
 *
 * @param response - Response from the fixed QHooks origin.
 * @returns The decoded JSON value.
 */
async function bodyOf(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_BODY)
    throw new QHooksError("response_too_large", "QHooks response exceeds the client limit.");
  if (!response.body) throw new QHooksError("invalid_response", "QHooks returned no JSON body.");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((size += value.length) > MAX_BODY) {
        await reader.cancel();
        throw new QHooksError("response_too_large", "QHooks response exceeds the client limit.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new QHooksError("invalid_response", "QHooks returned invalid JSON.");
  }
}
/** Fixed-origin client for reviewed read and unsigned-plan tools. */
export class QHooksClient {
  readonly #referrer?: string;
  readonly #transport: "mcp" | "rest";
  readonly #timeout: number;
  readonly #fetch: typeof fetch;
  #id = 0;
  /**
   * Configure attribution and bounded transport behavior.
   *
   * @param options - Public referrer and transport options; no credentials.
   */
  constructor(options: QHooksOptions = {}) {
    if (options.referrer !== undefined && !evm(options.referrer))
      throw new QHooksError("invalid_referrer", "Use a nonzero public EVM referral address.");
    if (options.transport !== undefined && !["mcp", "rest"].includes(options.transport))
      throw new QHooksError("invalid_transport", "Choose mcp or rest.");
    this.#referrer = options.referrer;
    this.#transport = options.transport ?? "mcp";
    this.#timeout = options.timeoutMs ?? 20000;
    if (!Number.isSafeInteger(this.#timeout) || this.#timeout < 1000 || this.#timeout > 30000)
      throw new QHooksError("invalid_timeout", "Use a timeout from 1000 to 30000 milliseconds.");
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
  }
  /**
   * Invoke one pinned tool without signing or submitting a plan.
   *
   * @param name - Pinned tool name.
   * @param args - User-requested arguments validated locally before transport.
   * @param walletReferrer - Lazy public-address fallback for eligible attribution.
   * @returns Original structured data or unsigned plan.
   */
  async call(
    name: ToolName,
    args: unknown,
    walletReferrer?: () => string | undefined,
  ): Promise<unknown> {
    if (!hasOwn(SCHEMAS, name))
      throw new QHooksError(
        "unsupported_tool",
        "This adapter exposes only the pinned QHooks read and prepare tools.",
      );
    const parsed = SCHEMAS[name].safeParse(args);
    if (!parsed.success)
      throw new QHooksError("invalid_arguments", "Arguments do not match the QHooks tool schema.");
    if (!object(parsed.data))
      throw new QHooksError("invalid_arguments", "Expected object arguments.");
    const input: Record<string, unknown> = { ...parsed.data };
    // Preserve an explicit supplied referrer. A configured operator wallet only fills an absent field.
    if (name === "prepare_trade" || name === "prepare_launch") {
      if (input.referrer === undefined) {
        const referrer = this.#referrer ?? walletReferrer?.();
        if (referrer !== undefined) input.referrer = referrer;
      }
      if (
        input.referrer !== undefined &&
        (typeof input.referrer !== "string" || !evm(input.referrer))
      )
        throw new QHooksError("invalid_referrer", "Use a nonzero public EVM referral address.");
    }
    let url = ORIGIN + "/mcp",
      method = "POST",
      body: string | undefined;
    const id = ++this.#id;
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      "MCP-Protocol-Version": "2025-06-18",
    };
    if (this.#transport === "mcp")
      body = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: input },
      });
    else {
      url = ORIGIN + "/api/v1/agent/" + ROUTE[name];
      if (
        name.startsWith("prepare_") ||
        name.startsWith("otc_") ||
        (name.startsWith("agreement_") && name !== "agreement_status")
      )
        body = JSON.stringify(input);
      else {
        method = "GET";
        const query = new URLSearchParams();
        for (const [k, v] of Object.entries(input)) if (v !== undefined) query.set(k, String(v));
        if (query.size) url += "?" + query;
      }
    }
    if (body && new TextEncoder().encode(body).length > 65536)
      throw new QHooksError("request_too_large", "QHooks requests must fit 64 KiB.");
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        body,
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(this.#timeout),
      });
    } catch {
      throw new QHooksError(
        "transport_unavailable",
        "QHooks could not be reached. No automatic retry or transaction was sent.",
      );
    }
    if (!response.ok) {
      const status = response.status,
        delay = retryAfter(response.headers.get("retry-after"));
      throw new QHooksError(
        status === 429 ? "rate_limited" : status === 503 ? "unavailable" : "http_error",
        status === 429
          ? "QHooks read limit reached. Respect the retry interval."
          : status === 503
            ? "QHooks data is refreshing. Unavailable is not zero or permission to trade."
            : "QHooks refused this request.",
        status,
        delay,
      );
    }
    const payload = await bodyOf(response);
    if (!object(payload))
      throw new QHooksError("invalid_response", "QHooks returned an invalid result.");
    let data: unknown = payload;
    if (this.#transport === "mcp") {
      if (payload.jsonrpc !== "2.0" || payload.id !== id)
        throw new QHooksError("invalid_response", "QHooks response does not match the request.");
      if (payload.error) throw new QHooksError("rpc_error", "QHooks refused this RPC request.");
      const result = payload.result;
      if (!object(result))
        throw new QHooksError("invalid_response", "QHooks returned an invalid MCP result.");
      if (result.isError)
        throw new QHooksError(
          "tool_unavailable",
          "QHooks refused the tool request or its data is refreshing. Unavailable is not zero.",
        );
      const content = result.content;
      let text: unknown;
      if (
        Array.isArray(content) &&
        content[0]?.type === "text" &&
        typeof content[0]?.text === "string"
      ) {
        try {
          text = JSON.parse(content[0].text);
        } catch {
          throw new QHooksError("invalid_response", "QHooks returned invalid tool JSON.");
        }
      }
      data = hasOwn(result, "structuredContent") ? result.structuredContent : text;
      if (data === undefined || (text !== undefined && !sameJson(data, text)))
        throw new QHooksError("invalid_response", "QHooks tool representations do not agree.");
    }
    if (!object(data) || data.error || data.ok === false)
      throw new QHooksError(
        "tool_unavailable",
        "QHooks data is unavailable or the tool refused the request. Preserve unknown values.",
      );
    if (name === "prepare_trade") {
      try {
        validateTradePlan(data, input);
      } catch {
        throw new QHooksError(
          "unsafe_trade_plan",
          "The unsigned trade plan does not match this request. Prepare it again before wallet review.",
        );
      }
    }
    // Preserve raw integer amounts, partial/unknown costs, cache coverage and unsigned plan fields exactly.
    return data;
  }
}
