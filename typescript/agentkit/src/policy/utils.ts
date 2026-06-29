import { ActionContext } from "./interfaces";

/**
 * Minimal JCS-like canonicalization for ActionContext.
 * Sorts keys and removes undefined values.
 */
export function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalize(item)).join(",") + "]";
  }
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => `"${k}":${canonicalize(obj[k])}`).join(",") + "}";
}

/**
 * SHA-256 hash of a string.
 */
export async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * recipientAllocationHash generates a hash over sorted recipient address+amount pairs.
 */
export async function recipientAllocationHash(
  recipients: Array<{ address: string; amount: bigint }>,
): Promise<string> {
  const normalized = recipients
    .map((r) => ({ to: r.address.toLowerCase(), amount_atomic: r.amount.toString() }))
    .sort((a, b) => a.to.localeCompare(b.to) || a.amount_atomic.localeCompare(b.amount_atomic));
  return sha256(canonicalize(normalized));
}

/**
 * actionContextHash generates the hash of an ActionContext.
 */
export async function actionContextHash(ctx: ActionContext): Promise<string> {
  return sha256(canonicalize(ctx));
}
