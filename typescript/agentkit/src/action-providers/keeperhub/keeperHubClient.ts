import { createHash } from "node:crypto";
import { KEEPERHUB_BASE_URL } from "./constants";

export interface KeeperHubClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Per-request HTTP timeout, in milliseconds. */
  timeoutMs?: number;
  /**
   * Extra attempts for the status read after a timeout, network error, 429 or
   * 5xx. Default 3. Only the read is retried: it has no side effects. Transfers
   * are not retried here; the caller retries them with the same taskId.
   */
  statusRetries?: number;
  /** Delay before the first status retry, doubled each time. Default 1000 ms. */
  retryDelayMs?: number;
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
  /** 0 when no answer was obtained after every retry. */
  httpStatus: number;
  /** How many requests it took. */
  attempts?: number;
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
  readonly #statusRetries: number;
  readonly #retryDelayMs: number;

  /**
   * Creates a client.
   *
   * @param config - API key, optional base URL, timeout and retry settings
   */
  constructor(config: KeeperHubClientConfig) {
    if (!config.apiKey) throw new Error("KEEPERHUB_API_KEY is not set");
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl ?? KEEPERHUB_BASE_URL;
    this.#timeoutMs = config.timeoutMs ?? 60_000;
    this.#statusRetries = config.statusRetries ?? 3;
    this.#retryDelayMs = config.retryDelayMs ?? 1_000;
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
   * Retried on timeout, network error, 429 and 5xx, with exponential backoff.
   * If every attempt fails, returns `httpStatus: 0` rather than throwing, so
   * the caller can say "not known yet" instead of reporting a failure.
   *
   * @param executionId - The executionId returned by executeTransfer
   * @returns Status and receipts, or httpStatus 0 if no answer was obtained
   */
  async getStatus(executionId: string): Promise<StatusResult> {
    let lastError = "unknown";
    for (let attempt = 0; attempt <= this.#statusRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, this.#retryDelayMs * 2 ** (attempt - 1)));
      }
      try {
        const { httpStatus, json } = await this.#request(`/api/execute/${executionId}/status`);
        if (httpStatus === 429 || httpStatus >= 500) {
          lastError = `HTTP ${httpStatus}`;
          continue;
        }
        return {
          executionId: (json.executionId as string) ?? executionId,
          status: (json.status as string) ?? "unknown",
          transactionHash: json.transactionHash as string | undefined,
          transactionLink: json.transactionLink as string | undefined,
          receipts: json.receipts as Receipt[] | undefined,
          error: (json.error as string | null) ?? null,
          httpStatus,
          attempts: attempt + 1,
        };
      } catch (e) {
        lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      }
    }
    return {
      executionId,
      status: "unknown",
      error: lastError,
      httpStatus: 0,
      attempts: this.#statusRetries + 1,
    };
  }

  /**
   * One HTTP call with a deadline that covers the whole exchange, body included.
   *
   * `AbortSignal.timeout` alone was not enough: in the 0.10.4 campaign a status
   * call configured for 60 s hung for 925 s. We have not found why, so the
   * deadline is enforced twice: the abort signal, and a race against a timer
   * that rejects regardless of what fetch does with the signal.
   *
   * @param path - API path, starting with /
   * @param init - Fetch options, plus an optional idempotency key
   * @returns The HTTP status and parsed JSON body
   */
  async #request(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
    const { idempotencyKey, ...rest } = init;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new DOMException(`KeeperHub request exceeded ${this.#timeoutMs} ms`, "TimeoutError"),
        );
      }, this.#timeoutMs);
    });
    const exchange = (async () => {
      const res = await fetch(`${this.#baseUrl}${path}`, {
        ...rest,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          ...(rest.body ? { "content-type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          ...(rest.headers as Record<string, string> | undefined),
        },
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { httpStatus: res.status, json };
    })();
    try {
      return await Promise.race([exchange, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}
