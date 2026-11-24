/**
 * actionRef.ts — action_ref v1 derivation, no AgentKit dependency.
 *
 *   action_ref = SHA-256( JCS( {agent_id, action_type, scope, timestamp} ) )
 *
 * Reference: docs/spec/action-ref.md (Domain paragraph) and
 * plugins/agt_evidence_anchor/action_ref.py in argentum-core.
 *
 * Domain, enforced before hashing (a value outside it is refused, never hashed):
 *   - agent_id, action_type, scope: ASCII only;
 *   - scope: non-empty;
 *   - timestamp: exactly YYYY-MM-DDTHH:MM:SS.mmmZ (RFC 3339, UTC, three fractional
 *     digits) and a real calendar instant (year >= 0001, valid month/day/hour/minute,
 *     second 00-59).
 *
 * For ASCII string fields, JSON.stringify of the keys in lexicographic order is the
 * RFC 8785 serialization, so no separate JCS library is needed here.
 */

import { createHash } from "crypto";

export class OutOfProfileDomainError extends Error {
  field: string;
  reason: string;

  constructor(field: string, reason: string) {
    super(`OUT_OF_PROFILE_DOMAIN: ${field}: ${reason}`);
    this.name = "OutOfProfileDomainError";
    this.field = field;
    this.reason = reason;
  }
}

const TIMESTAMP_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\.[0-9]{3}Z$/;
const ASCII_RE = /^[\x00-\x7f]*$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function validateDomain(
  agent_id: string,
  action_type: string,
  scope: string,
  timestamp: string,
): void {
  for (const [field, value] of [
    ["agent_id", agent_id],
    ["action_type", action_type],
    ["scope", scope],
  ] as const) {
    if (typeof value !== "string") throw new OutOfProfileDomainError(field, "must be a string");
    if (!ASCII_RE.test(value)) {
      throw new OutOfProfileDomainError(field, "non-ASCII character in field value");
    }
  }
  if (scope.length === 0) {
    throw new OutOfProfileDomainError("scope", 'must be a non-empty string -- no "not applicable" exception');
  }
  if (typeof timestamp !== "string") throw new OutOfProfileDomainError("timestamp", "must be a string");
  const m = TIMESTAMP_RE.exec(timestamp);
  if (!m) {
    throw new OutOfProfileDomainError(
      "timestamp",
      "does not match the accepted grammar -- RFC 3339 (YYYY-MM-DDTHH:MM:SS.mmmZ)",
    );
  }
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const real =
    year >= 1 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth(year, month) &&
    hour <= 23 && minute <= 59 && second <= 59;
  if (!real) {
    throw new OutOfProfileDomainError(
      "timestamp",
      "matches the required grammar but does not denote a real calendar instant",
    );
  }
}

export function computeActionRef(
  agent_id: string,
  action_type: string,
  scope: string,
  timestamp: string,
): string {
  validateDomain(agent_id, action_type, scope, timestamp);
  // Keys in lexicographic order = RFC 8785 order for these four ASCII-valued members.
  const canonical = JSON.stringify({ action_type, agent_id, scope, timestamp });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
