/**
 * One leg of a Chord route.
 */
export interface ChordRouteLeg {
  percent: number;
  swapInfo: {
    dex: string;
    pool: string;
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    adapter: string;
    extraData: string;
  };
}

/**
 * Body of `GET /quote`. Amounts are integer strings in the token's smallest unit.
 */
export interface ChordQuoteResponse {
  // The body is sent back to POST /swap unmodified, including fields this package does not read.
  [key: string]: unknown;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: ChordRouteLeg[];
  noRouteReason?: string;
  gasEstimate?: string;
  blockNumber?: number;
  feeBps?: number;
  feeAmount?: string;
  feeMint?: string;
  valueLossPct?: number | null;
  preliminary?: boolean;
}

/**
 * Unsigned transaction returned by `POST /swap`.
 */
export interface ChordSwapTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  chainId: number;
}

/**
 * Body of `POST /swap`.
 */
export interface ChordSwapResponse {
  transaction: ChordSwapTransaction;
  lastValidBlockHeight?: number;
}

/**
 * Body of `POST /swap/simulate`.
 */
export interface ChordSimulationResponse {
  ok: boolean;
  amountOut?: string | null;
  gas?: number | null;
  revert?: string;
  selector?: string | null;
}

/**
 * One row of `GET /tokens/search`.
 */
export interface ChordToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number | null;
  verified: boolean;
  tags?: string[];
}

/**
 * Error raised for a non-2xx answer from the Chord API.
 */
export class ChordApiError extends Error {
  /**
   * Creates a ChordApiError.
   *
   * @param status - HTTP status code.
   * @param code - Machine-readable error code from the API, e.g. `INVALID_PARAMS`.
   * @param message - Human-readable message.
   */
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChordApiError";
  }
}

/**
 * Options for the Chord API client.
 */
export interface ChordApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Minimal client for the Chord REST API (https://getchord.xyz/docs).
 */
export class ChordApiClient {
  readonly #baseUrl: string;
  readonly #apiKey?: string;
  readonly #timeoutMs: number;

  /**
   * Creates a client.
   *
   * @param options - Base URL, optional API key and request timeout.
   */
  constructor(options: ChordApiClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#apiKey = options.apiKey;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  /**
   * Fetches the best route for a swap.
   *
   * @param params - Quote parameters.
   * @param params.chainId - EVM chain id.
   * @param params.inputMint - Token sold (zero address = native coin).
   * @param params.outputMint - Token bought (zero address = native coin).
   * @param params.amount - Input amount in the token's smallest unit.
   * @param params.slippageBps - Slippage tolerance in basis points.
   * @returns The quote body.
   */
  async getQuote(params: {
    chainId: number;
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<ChordQuoteResponse> {
    const query = new URLSearchParams({
      chain: String(params.chainId),
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount.toString(),
      slippageBps: String(params.slippageBps),
    });
    return this.#request<ChordQuoteResponse>("GET", `/quote?${query.toString()}`);
  }

  /**
   * Builds the unsigned swap transaction for a quote.
   *
   * @param params - Build parameters.
   * @param params.chainId - EVM chain id; must match the quote.
   * @param params.quote - The `/quote` body, unmodified.
   * @param params.userAddress - Wallet that signs and receives the output.
   * @param params.slippageBps - Same slippage the quote was requested with.
   * @returns The unsigned transaction.
   */
  async buildSwap(params: {
    chainId: number;
    quote: ChordQuoteResponse;
    userAddress: string;
    slippageBps: number;
  }): Promise<ChordSwapResponse> {
    return this.#request<ChordSwapResponse>("POST", "/swap", {
      quoteResponse: params.quote,
      userPublicKey: params.userAddress,
      chain: params.chainId,
      slippageBps: params.slippageBps,
    });
  }

  /**
   * Runs a built transaction as `eth_call` from the sender to catch a revert before signing.
   *
   * @param params - Simulation parameters.
   * @param params.chainId - EVM chain id.
   * @param params.from - Sender address.
   * @param params.to - Transaction target.
   * @param params.data - Calldata.
   * @param params.value - Native value in the smallest unit.
   * @returns The simulation verdict.
   */
  async simulate(params: {
    chainId: number;
    from: string;
    to: string;
    data: string;
    value: string;
  }): Promise<ChordSimulationResponse> {
    return this.#request<ChordSimulationResponse>("POST", "/swap/simulate", {
      chain: params.chainId,
      from: params.from,
      to: params.to,
      data: params.data,
      value: params.value,
    });
  }

  /**
   * Searches tokens on a chain by symbol, name or address.
   *
   * @param params - Search parameters.
   * @param params.chainId - EVM chain id.
   * @param params.query - Symbol, name or address fragment.
   * @param params.limit - Maximum rows.
   * @returns Matching tokens.
   */
  async searchTokens(params: {
    chainId: number;
    query: string;
    limit?: number;
  }): Promise<ChordToken[]> {
    const query = new URLSearchParams({
      chain: String(params.chainId),
      q: params.query,
      limit: String(params.limit ?? 10),
    });
    const body = await this.#request<{ tokens?: ChordToken[] }>(
      "GET",
      `/tokens/search?${query.toString()}`,
    );
    return body.tokens ?? [];
  }

  /**
   * Sends a request and parses the JSON answer.
   *
   * @param method - HTTP method.
   * @param path - Path and query, relative to the base URL.
   * @param body - JSON body for POST requests.
   * @returns The parsed body.
   */
  async #request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.#apiKey) headers["X-API-Key"] = this.#apiKey;

    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    const text = await response.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      const errorBody = (parsed ?? {}) as { error?: string; message?: string };
      throw new ChordApiError(
        response.status,
        errorBody.error ?? `HTTP_${response.status}`,
        errorBody.message ?? (text.slice(0, 300) || response.statusText),
      );
    }

    if (parsed === undefined) {
      throw new ChordApiError(
        response.status,
        "BAD_RESPONSE",
        "Chord API returned a non-JSON body",
      );
    }

    return parsed as T;
  }
}
