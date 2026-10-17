import { createHash, createPublicKey, verify } from "node:crypto";

/**
 * Canonical bytes for the ordinary front-door verifier's integer-safe subset.
 *
 * @param value - Input for this check.
 * @returns The checked result.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (
      typeof value === "string" &&
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)
    )
      throw new Error("Invalid Unicode");
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const compare = (a: string, b: string) => {
      const x = Array.from(a, c => c.codePointAt(0)!);
      const y = Array.from(b, c => c.codePointAt(0)!);
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
      return x.length - y.length;
    };
    return `{${Object.keys(obj)
      .sort(compare)
      .map(k => `${canonical(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  throw new Error("Unsupported canonical value (only safe integer numbers supported)");
}

/**
 * Inspect ordinary records without granting execution.
 *
 * @param value - Input for this check.
 * @param size - Input for this check.
 * @returns The checked result.
 */
function decode(value: unknown, size: number): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Invalid signature encoding");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== size || bytes.toString("base64url") !== value)
    throw new Error("Invalid signature length/encoding");
  return bytes;
}

/**
 * Verify integrity and request identity, never infer execution authority.
 *
 * @param envelope - Input for this check.
 * @param request - Input for this check.
 * @param key - Input for this check.
 * @param now - Input for this check.
 * @returns The checked result.
 */
export function verifyRecord(
  envelope: Record<string, unknown>,
  request: unknown,
  key: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const record = envelope?.record as {
    type?: string;
    not_sealed_mark?: boolean;
    mock?: boolean;
    not_a_determination?: boolean;
    environment?: string;
    issued_at: number;
    valid_until: number;
    input?: unknown;
    input_hash?: string;
    revoked?: boolean;
    status?: string;
    determination?: { outcome: string };
    alg?: string;
    public_key_b64url?: string;
    value_b64url?: string;
  };
  const sig = envelope?.signature as {
    type?: string;
    not_sealed_mark?: boolean;
    mock?: boolean;
    not_a_determination?: boolean;
    environment?: string;
    issued_at: number;
    valid_until: number;
    input?: unknown;
    input_hash?: string;
    revoked?: boolean;
    status?: string;
    determination?: { outcome: string };
    alg?: string;
    public_key_b64url?: string;
    value_b64url?: string;
  };
  if (!record || record.type !== "WHP-FRONTDOOR-EVALUATION-v1" || record.not_sealed_mark !== true)
    throw new Error("Unexpected record type");
  if (record.mock === true || record.not_a_determination === true || record.environment === "TEST")
    throw new Error("Mock/test record");
  if (sig?.alg !== "Ed25519" || sig.public_key_b64url !== key)
    throw new Error("Missing signature or signing key mismatch");
  const bytes = Buffer.from(canonical(record), "utf8");
  if (createHash("sha256").update(bytes).digest("hex") !== envelope.record_hash)
    throw new Error("Record hash mismatch");
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), decode(key, 32)]),
    format: "der",
    type: "spki",
  });
  if (!verify(null, bytes, publicKey, decode(sig.value_b64url, 64)))
    throw new Error("Invalid Ed25519 signature");
  if (
    !Number.isSafeInteger(record.issued_at) ||
    !Number.isSafeInteger(record.valid_until) ||
    record.issued_at > now ||
    record.valid_until <= now ||
    record.valid_until <= record.issued_at ||
    now - record.issued_at > 120
  )
    throw new Error("Stale or invalid issuance window");
  if (canonical(record.input) !== canonical(request))
    throw new Error("Exact request binding mismatch");
  if (createHash("sha256").update(canonical(request)).digest("hex") !== record.input_hash)
    throw new Error("Input hash mismatch");
  if (record.revoked === true || record.status === "REVOKED") throw new Error("Revoked record");
  if (record.determination?.outcome !== "ESTABLISHED")
    throw new Error("Determination is not ESTABLISHED");
  return envelope.record_hash as string;
}
