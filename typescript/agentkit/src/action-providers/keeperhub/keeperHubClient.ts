import { createHash } from "node:crypto";
import { KEEPERHUB_BASE_URL } from "./constants";

export interface KeeperHubClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Per-request HTTP timeout, in milliseconds. */
  timeoutMs?: number;
}

export interface SimulationResult {
  success: boolean;
  wouldRevert: boolean;
  failureKind?: string;
  revertReason?: string;
  gasEstimate?: string;
  error?: string;
}

export interface ExecutionResult {
  executionId?: string;
  status?: string;
  transactionHash?: string;
  transactionLink?: string;
  error?: string;
  code?: string;
  httpStatus: number;
}

export interface Receipt {
  hash: string;
  chainId: number;
  gasUsed?: string;
  verified?: boolean;
  verifiedAt?: string;
  blockNumber?: number;
  receiptStatus?: string;
}

export interface StatusResult {
  executionId: string;
  status: string;
  transactionHash?: string;
  transactionLink?: string;
  receipts?: Receipt[];
  error?: string | null;
  httpStatus: number;
}

/**
 * Deterministic idempotency key.
 *
 * The scheme is exactly the one KeeperHub documents in its "Choosing a stable
 * key" guide: `taskId|chainId|recipientAddress|amount|tokenAddress`, joined by
 * U+007C with no surrounding spaces.
 *
 * Why derived rather than random: a UUID generated per attempt does not survive
 * a retry. The second attempt gets a different UUID, is treated as new work,
 * and executes again. The key must identify the WORK, not the ATTEMPT.
 *
 * The hash is shaped into a UUID v4 because some layers below require that
 * format.
 *
 * @param parts - The fields that decide the onchain effect of the work
 * @param parts.taskId - Stable identifier of the work, e.g. an invoice number
 * @param parts.chainId - Chain the transfer runs on
 * @param parts.recipientAddress - Recipient address
 * @param parts.amount - Amount in whole units
 * @param parts.tokenAddress - ERC-20 address, or undefined for the native token
 * @returns The idempotency key, shaped as a UUID v4
 */
export function deriveIdempotencyKey(parts: {
  taskId: string;
  chainId: number;
  recipientAddress: string;
  amount: string;
  tokenAddress?: string;
}): string {
  const canonical = [
    parts.taskId,
    parts.chainId,
    parts.recipientAddress,
    parts.amount,
    parts.tokenAddress ?? "",
  ].join("|");
  const b = Buffer.from(createHash("sha256").update(canonical).digest().subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Minimal REST client for KeeperHub direct execution.
 */
export class KeeperHubClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  /**
   * Creates a client.
   *
   * @param config - API key, optional base URL and per-request timeout
   */
  constructor(config: KeeperHubClientConfig) {
    if (!config.apiKey) throw new Error("KEEPERHUB_API_KEY is not set");
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl ?? KEEPERHUB_BASE_URL;
    this.#timeoutMs = config.timeoutMs ?? 60_000;
  }

  /**
   * Dry run. The `simulate` key is written here, once, by code. It never comes
   * from model input, so the misspelling class KeeperHub tracks in #2004 cannot
   * happen through this path.
   *
   * @param body - Transfer body without the simulate flag
   * @returns The simulation outcome
   */
  async simulateTransfer(body: Record<string, unknown>): Promise<SimulationResult> {
    const { json } = await this.#request("/api/execute/transfer", {
      method: "POST",
      body: JSON.stringify({ ...body, simulate: true }),
    });
    return {
      success: json.success === true,
      wouldRevert: json.wouldRevert === true,
      failureKind: json.failureKind as string | undefined,
      revertReason: json.revertReason as string | undefined,
      gasEstimate: json.gasEstimate as string | undefined,
      error: json.error as string | undefined,
    };
  }

  /**
   * Executes a transfer once under the given idempotency key.
   *
   * @param body - Transfer body
   * @param idempotencyKey - Key derived from the work, see deriveIdempotencyKey
   * @returns The execution handle and HTTP status
   */
  async executeTransfer(
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ExecutionResult> {
    const { httpStatus, json } = await this.#request("/api/execute/transfer", {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    });
    return {
      executionId: json.executionId as string | undefined,
      status: json.status as string | undefined,
      transactionHash: json.transactionHash as string | undefined,
      transactionLink: json.transactionLink as string | undefined,
      error: json.error as string | undefined,
      code: json.code as string | undefined,
      httpStatus,
    };
  }

  /**
   * Final outcome of an execution, with receipts re-read from chain.
   *
   * @param executionId - The executionId returned by executeTransfer
   * @returns Status and receipts
   */
  async getStatus(executionId: string): Promise<StatusResult> {
    const { httpStatus, json } = await this.#request(`/api/execute/${executionId}/status`);
    return {
      executionId: (json.executionId as string) ?? executionId,
      status: (json.status as string) ?? "unknown",
      transactionHash: json.transactionHash as string | undefined,
      transactionLink: json.transactionLink as string | undefined,
      receipts: json.receipts as Receipt[] | undefined,
      error: (json.error as string | null) ?? null,
      httpStatus,
    };
  }

  /**
   * Sends an authenticated request and parses the JSON body.
   *
   * @param path - API path, starting with /
   * @param init - Fetch options, plus an optional idempotency key
   * @returns The HTTP status and parsed JSON body
   */
  async #request(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
    const { idempotencyKey, ...rest } = init;
    const res = await fetch(`${this.#baseUrl}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(this.#timeoutMs),
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { httpStatus: res.status, json };
  }
}
