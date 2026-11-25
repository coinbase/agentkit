import { createHash } from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import {
  MAX_DOCUMENT_BYTES,
  ML_DSA_65_PUBLIC_KEY_BYTES,
  ML_DSA_65_SIGNATURE_BYTES,
} from "./constants";

/**
 * A verification failure with a stable reason code. Used internally; the verifier converts it
 * into a `reasons[]` entry and never lets it escape an action.
 */
export class ReceiptError extends Error {
  readonly code: string;

  /**
   * Creates a new ReceiptError.
   *
   * @param code - Stable reason code (e.g. `SIGNATURE_INVALID`)
   * @param detail - Human-readable detail
   */
  constructor(code: string, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}

const MAX_DEPTH = 32;
const MAX_NODES = 100_000;

/**
 * Strict RFC 8259 JSON parser. Unlike `JSON.parse` it refuses duplicate object keys, lone
 * surrogates, a byte-order mark, trailing data, non-finite numbers, excessive depth and size,
 * so that two verifiers reading the same bytes can never see different documents.
 *
 * @param text - JSON text
 * @returns The parsed value
 */
export function parseStrictJson(text: string): unknown {
  if (typeof text !== "string") throw new ReceiptError("JSON_INVALID", "input is not text");
  if (Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    throw new ReceiptError("JSON_TOO_LARGE", `document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  }
  if (text.charCodeAt(0) === 0xfeff) throw new ReceiptError("JSON_INVALID", "byte-order mark");
  let i = 0;
  let nodes = 0;
  const err = (msg: string): never => {
    throw new ReceiptError("JSON_INVALID", `${msg} at offset ${i}`);
  };
  const ws = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else break;
    }
  };
  const parseString = (): string => {
    if (text[i] !== '"') err("expected string");
    i++;
    let out = "";
    for (;;) {
      if (i >= text.length) err("unterminated string");
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        i++;
        break;
      }
      if (c < 0x20) err("control character in string");
      if (c === 0x5c) {
        const e = text[i + 1];
        i += 2;
        if (e === '"' || e === "\\" || e === "/") out += e;
        else if (e === "b") out += "\b";
        else if (e === "f") out += "\f";
        else if (e === "n") out += "\n";
        else if (e === "r") out += "\r";
        else if (e === "t") out += "\t";
        else if (e === "u") {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) err("bad unicode escape");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else err("bad escape");
      } else {
        out += text[i];
        i++;
      }
    }
    for (let k = 0; k < out.length; k++) {
      const c = out.charCodeAt(k);
      if (c >= 0xd800 && c <= 0xdbff) {
        const d = out.charCodeAt(k + 1);
        if (!(d >= 0xdc00 && d <= 0xdfff)) {
          throw new ReceiptError("JSON_LONE_SURROGATE", "lone surrogate in string");
        }
        k++;
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        throw new ReceiptError("JSON_LONE_SURROGATE", "lone surrogate in string");
      }
    }
    return out;
  };
  const parseValue = (depth: number): unknown => {
    if (++nodes > MAX_NODES) throw new ReceiptError("JSON_TOO_LARGE", "too many JSON nodes");
    if (depth > MAX_DEPTH) throw new ReceiptError("JSON_TOO_DEEP", "JSON nesting too deep");
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const obj: Record<string, unknown> = {};
      const seen = new Set<string>();
      ws();
      if (text[i] === "}") {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        const key = parseString();
        if (seen.has(key)) {
          throw new ReceiptError("JSON_DUPLICATE_KEY", `duplicate key ${JSON.stringify(key)}`);
        }
        seen.add(key);
        ws();
        if (text[i] !== ":") err("expected ':'");
        i++;
        const value = parseValue(depth + 1);
        // defineProperty: a "__proto__" key stays an ordinary data property.
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return obj;
        }
        err("expected ',' or '}'");
      }
    }
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValue(depth + 1));
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return arr;
        }
        err("expected ',' or ']'");
      }
    }
    if (c === '"') return parseString();
    if (text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    const m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i, i + 400));
    if (!m) return err("unexpected token");
    const n = Number(m[0]);
    if (!Number.isFinite(n)) throw new ReceiptError("JSON_INVALID", "number out of range");
    i += m[0].length;
    return n;
  };
  const value = parseValue(0);
  ws();
  if (i !== text.length) err("trailing data");
  return value;
}

/**
 * RFC 8785 (JCS) canonical JSON. ECMAScript number formatting and UTF-16 key order are exactly
 * what JCS prescribes. With `signedSubset`, only strings, booleans, null, arrays, objects and safe
 * integers are accepted: the subset every runtime canonicalises identically.
 *
 * @param value - Value to canonicalise
 * @param signedSubset - Refuse anything but safe integers as numbers
 * @returns Canonical JSON text
 */
export function jcs(value: unknown, signedSubset = false): string {
  let nodes = 0;
  const walk = (v: unknown, depth: number): string => {
    if (++nodes > MAX_NODES) throw new ReceiptError("JSON_TOO_LARGE", "too many JSON nodes");
    if (depth > MAX_DEPTH) throw new ReceiptError("JSON_TOO_DEEP", "JSON nesting too deep");
    if (v === null) return "null";
    switch (typeof v) {
      case "boolean":
        return v ? "true" : "false";
      case "string":
        return JSON.stringify(v);
      case "number":
        if (!Number.isFinite(v)) throw new ReceiptError("JSON_INVALID", "non-finite number");
        if (signedSubset && (!Number.isSafeInteger(v) || Object.is(v, -0))) {
          throw new ReceiptError(
            "SIGNED_JSON_NUMBER",
            `signed JSON may only contain safe integers (got ${v})`,
          );
        }
        return JSON.stringify(Object.is(v, -0) ? 0 : v);
      case "object": {
        if (Array.isArray(v)) return `[${v.map(x => walk(x, depth + 1)).join(",")}]`;
        const obj = v as Record<string, unknown>;
        return `{${Object.keys(obj)
          .sort()
          .map(k => {
            if (obj[k] === undefined) {
              throw new ReceiptError("JSON_INVALID", `undefined value at ${JSON.stringify(k)}`);
            }
            return `${JSON.stringify(k)}:${walk(obj[k], depth + 1)}`;
          })
          .join(",")}}`;
      }
      default:
        throw new ReceiptError("JSON_INVALID", `unsupported type ${typeof v}`);
    }
  };
  return walk(value, 0);
}

/**
 * Lowercase hex SHA-256.
 *
 * @param data - UTF-8 text or bytes
 * @returns Hex digest
 */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("hex");
}

/**
 * FractalAI key id: first 16 hex characters of SHA-256 over the base64 key text.
 *
 * @param publicKeyB64 - Canonical base64 public key
 * @returns The kid
 */
export function kidForKey(publicKeyB64: string): string {
  return sha256Hex(publicKeyB64).slice(0, 16);
}

/**
 * Strict base64 (RFC 4648 §4, padded, standard alphabet): the text must re-encode to itself.
 *
 * @param text - Base64 text
 * @param expectedBytes - Required decoded length, if any
 * @returns The bytes, or null on any deviation
 */
export function decodeCanonicalBase64(text: unknown, expectedBytes?: number): Uint8Array | null {
  if (typeof text !== "string" || text.length === 0 || text.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const buf = Buffer.from(text, "base64");
  if (buf.toString("base64") !== text) return null;
  if (expectedBytes !== undefined && buf.length !== expectedBytes) return null;
  return new Uint8Array(buf);
}

/**
 * ML-DSA-65 (FIPS 204, pure, empty context) verification. Never throws.
 *
 * Note: `@noble/post-quantum` 0.4.x takes `(publicKey, message, signature)`; later majors use
 * `(signature, message, publicKey)`. The argument order is pinned by the known-answer test on a
 * production receipt in the test suite.
 *
 * @param publicKey - 1952-byte public key
 * @param message - Signed message bytes
 * @param signature - 3309-byte signature
 * @returns Whether the signature is valid
 */
export function mlDsa65Verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  if (
    publicKey.length !== ML_DSA_65_PUBLIC_KEY_BYTES ||
    signature.length !== ML_DSA_65_SIGNATURE_BYTES
  ) {
    return false;
  }
  try {
    return ml_dsa65.verify(publicKey, message, signature) === true;
  } catch {
    return false;
  }
}

/**
 * UTF-8 bytes of a string.
 *
 * @param text - Text
 * @returns Bytes
 */
export function utf8(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

/**
 * Makes an untrusted string safe to hand to a model or a log: one line, no control, bidi or
 * zero-width characters, bounded length.
 *
 * @param value - Untrusted text
 * @param max - Maximum length
 * @returns Sanitized text
 */
export function sanitizeText(value: string, max = 256): string {
  const cleaned = value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g,
    " ",
  );
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

/**
 * Recursively sanitizes the strings of a JSON value (see {@link sanitizeText}).
 *
 * @param value - Untrusted JSON value
 * @param depth - Current depth (internal)
 * @returns A sanitized copy
 */
export function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.slice(0, 32).map(v => sanitizeJson(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).slice(0, 64)) {
      out[sanitizeText(k, 64)] = sanitizeJson((value as Record<string, unknown>)[k], depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Plain-object check (not null, not an array).
 *
 * @param v - Candidate
 * @returns Whether `v` is a plain JSON object
 */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Own-property check that ignores the prototype chain.
 *
 * @param o - Object
 * @param k - Key
 * @returns Whether `o` has own property `k`
 */
export function own(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}
