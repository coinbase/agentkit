import canonicalize from "canonicalize";
import { ActionContext } from "./interfaces";

/**
 * SHA-256 hash of a string, using the Web Crypto API.
 */
export async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * recipientAllocationHash: RFC 8785 JCS hash over sorted address+amount pairs.
 * Catches address substitution, amount redistribution, and silent reordering.
 */
export async function recipientAllocationHash(
  recipients: Array<{ address: string; amount: bigint }>,
): Promise<string> {
  const normalized = recipients
    .map(r => ({ to: r.address.toLowerCase(), amount_atomic: r.amount.toString() }))
    .sort((a, b) => a.to.localeCompare(b.to) || a.amount_atomic.localeCompare(b.amount_atomic));
  return sha256(canonicalize(normalized) ?? "{}");
}

/**
 * actionContextHash: RFC 8785 JCS hash of an ActionContext.
 * Policy-independent content identifier for cross-implementation join keys.
 */
export async function actionContextHash(ctx: ActionContext): Promise<string> {
  return sha256(canonicalize(ctx) ?? "{}");
}
