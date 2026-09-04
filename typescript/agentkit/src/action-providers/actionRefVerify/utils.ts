import { createHash } from "crypto";

/**
 * RFC 8785 JCS encoding for a flat object of string values: sorted keys,
 * no extra whitespace, UTF-8. For string-only values this is equivalent to
 * JSON.stringify with sorted keys — same approach used by
 * argentum-core/plugins/agt_evidence_anchor/action_ref.py (_jcs_encode).
 *
 * @param obj - A flat object with string values only.
 * @returns The canonicalized JSON string.
 */
export function jcsEncode(obj: Record<string, string>): string {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

/**
 * Computes the SHA-256 hex digest of a UTF-8 string.
 *
 * @param input - The string to hash.
 * @returns The lowercase hex-encoded digest.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * action-ref-v1: SHA-256(JCS({agent_id, action_type, scope, timestamp})).
 * See https://github.com/giskard09/argentum-core/blob/master/docs/spec/action-ref.md
 *
 * @param agentId - The agent_id preimage field.
 * @param actionType - The action_type preimage field.
 * @param scope - The scope preimage field.
 * @param timestamp - RFC 3339 UTC timestamp with 3-digit ms precision.
 * @returns The 64-character lowercase hex action_ref.
 */
export function computeActionRef(
  agentId: string,
  actionType: string,
  scope: string,
  timestamp: string,
): string {
  const payload = {
    agent_id: agentId,
    action_type: actionType,
    scope,
    timestamp,
  };
  return sha256Hex(jcsEncode(payload));
}
