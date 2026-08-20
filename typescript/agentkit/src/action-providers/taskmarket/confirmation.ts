import { createHash, timingSafeEqual } from "crypto";

export const TASKMARKET_NETWORK = {
  name: "Base",
  chainId: 8453,
  networkId: "base-mainnet",
} as const;

export const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export interface TaskPreviewPayload {
  description: string;
  rewardUsdc: number;
  durationHours: number;
  mode: string;
  tags: string;
  deliverables: string;
}

interface TokenBody extends TaskPreviewPayload {
  issuedAt: number;
}

/**
 * Builds a confirmation token for a previewed create-task request.
 * The token is bound to the exact payload and expires after CONFIRMATION_TTL_MS.
 */
export function issueConfirmationToken(
  payload: TaskPreviewPayload,
  issuedAt = Date.now(),
): string {
  const body: TokenBody = { ...normalizePayload(payload), issuedAt };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const digest = hashPayload(body);
  return `${encoded}.${digest}`;
}

/**
 * Validates a confirmation token against the payload the caller is trying to create.
 * Returns an error string when invalid; otherwise null.
 */
export function validateConfirmationToken(
  token: string,
  payload: TaskPreviewPayload,
  now = Date.now(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return "confirmationToken is malformed.";
  }

  let body: TokenBody;
  try {
    body = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as TokenBody;
  } catch {
    return "confirmationToken could not be decoded.";
  }

  const expected = hashPayload(body);
  const actual = parts[1];
  if (!safeEqual(expected, actual)) {
    return "confirmationToken signature is invalid.";
  }

  if (typeof body.issuedAt !== "number" || now - body.issuedAt > CONFIRMATION_TTL_MS) {
    return "confirmationToken has expired. Run preview_taskmarket_task again.";
  }
  if (body.issuedAt > now + 30_000) {
    return "confirmationToken issuedAt is in the future.";
  }

  const normalized = normalizePayload(payload);
  if (
    body.description !== normalized.description ||
    body.rewardUsdc !== normalized.rewardUsdc ||
    body.durationHours !== normalized.durationHours ||
    body.mode !== normalized.mode ||
    body.tags !== normalized.tags ||
    body.deliverables !== normalized.deliverables
  ) {
    return "Create payload does not match the previewed confirmationToken. Preview again.";
  }

  return null;
}

export function normalizePayload(payload: TaskPreviewPayload): TaskPreviewPayload {
  return {
    description: payload.description.trim(),
    rewardUsdc: Number(payload.rewardUsdc),
    durationHours: Number(payload.durationHours),
    mode: (payload.mode || "bounty").trim(),
    tags: (payload.tags || "").trim(),
    deliverables: payload.deliverables.trim(),
  };
}

function hashPayload(body: TokenBody): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
