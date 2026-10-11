import { sanitizeOnchainMetadata } from "../../utils";
import { LIVENESS_LEVELS, MAX_TEXT_LENGTH, USDC_DECIMALS } from "./constants";
import { AgentSummary, Detection } from "./types";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Status and parsed JSON body of an API response.
 */
export interface ApiResult<T> {
  status: number;
  body: T | null;
}

/**
 * Options for a single API request.
 */
export interface RequestOptions {
  apiKey?: string;
  timeoutMs: number;
}

/**
 * Sends a GET request to the API and parses the JSON body.
 * A body that is not JSON is returned as null; network errors and timeouts throw.
 *
 * @param baseUrl - The API base URL, without a trailing slash
 * @param path - The request path, beginning with a slash
 * @param options - The request options (optional API key and timeout)
 * @returns The response status and parsed body
 */
export async function getJson<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.apiKey) {
    headers.authorization = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  let body: T | null = null;
  try {
    body = (await response.json()) as T;
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

/**
 * Cleans a string from the API before it reaches the model: strips control, zero-width and
 * other non-printable characters and caps the length. Non-strings become null.
 *
 * @param value - The value to clean
 * @param maxLength - The maximum length of the result
 * @returns The cleaned string, or null
 */
export function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = sanitizeOnchainMetadata(value, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Returns the address if it is a well-formed 0x address, or null.
 * Accepts a CAIP-10 account id (eip155:8453:0x...) and returns its address part.
 *
 * @param value - The value to check
 * @returns The address, or null
 */
export function cleanAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const address = value.includes(":") ? value.slice(value.lastIndexOf(":") + 1) : value;
  return ADDRESS_REGEX.test(address) ? address : null;
}

/**
 * Returns the value if it is a finite number, or null.
 *
 * @param value - The value to check
 * @returns The number, or null
 */
export function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Rounds a USD amount to cents.
 *
 * @param value - The amount in USD
 * @returns The amount rounded to two decimals, or null if it is not a number
 */
export function roundUsd(value: unknown): number | null {
  const amount = cleanNumber(value);
  return amount === null ? null : Math.round(amount * 100) / 100;
}

/**
 * Converts USDC base units (6 decimals, as a decimal string) to a USD decimal string without
 * floating-point rounding.
 *
 * @param value - The amount in USDC base units, e.g. "1234500"
 * @returns The amount in USD, e.g. "1.2345", or null if the value is missing or malformed
 */
export function formatUsdcBaseUnits(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{1,40}$/.test(value)) {
    return null;
  }
  const padded = value.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * Describes a public liveness level.
 *
 * @param level - The liveness level (7, 8 or 9)
 * @returns What the level means
 */
export function describeLevel(level: number): string {
  return LIVENESS_LEVELS[level] ?? "Below the public rank, which starts at L7.";
}

/**
 * Shapes a ranked agent for the model: only figures and identifiers the ledger computes,
 * each cleaned, with the meaning of its level spelled out.
 *
 * @param agent - The agent as returned by the API
 * @returns The agent summary
 */
export function summarizeAgent(agent: AgentSummary) {
  const level = cleanNumber(agent.liveness);
  return {
    token_id: cleanText(agent.token_id, 20),
    slug: cleanText(agent.slug, 40),
    chain: cleanText(agent.chain, 20),
    profile: cleanText(agent.url),
    registered_at: cleanText(agent.registered_at, 40),
    liveness: {
      level: level === null ? null : `L${level}`,
      meaning: level === null ? null : describeLevel(level),
    },
    wallet: {
      address: cleanAddress(agent.wallet),
      bound_by: cleanText(agent.bind_method_label, 80),
      binding_confidence: cleanText(agent.binding_confidence, 40),
      evidence: cleanText(agent.bind_evidence, 80),
      stablecoin_balance_usd: roundUsd(agent.stables_float),
      eip7702_delegate: cleanAddress(agent.delegated_7702),
    },
    payments: {
      count: cleanNumber(agent.pay?.events),
      total_usd: roundUsd(agent.pay?.usd),
      distinct_counterparties: cleanNumber(agent.pay?.counterparties),
      count_30d: cleanNumber(agent.pay?.events_30d),
      usd_30d: roundUsd(agent.pay?.usd_30d),
      first_payment_at: cleanText(agent.pay?.first, 40),
      last_payment_at: cleanText(agent.pay?.last, 40),
    },
    open_incidents: cleanNumber(agent.open_incidents),
  };
}

/**
 * Shapes a detection for the model.
 *
 * @param detection - The detection as returned by the API
 * @returns The detection summary
 */
export function summarizeDetection(detection: Detection) {
  return {
    kind: cleanText(detection.kind, 60),
    severity: cleanText(detection.severity, 20),
    at: cleanText(detection.at, 40),
    live_incident: detection.live === true,
    summary: cleanText(detection.headline),
  };
}
