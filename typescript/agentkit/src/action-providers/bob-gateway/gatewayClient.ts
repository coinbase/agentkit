import { Hex } from "viem";

/** Parameters for requesting a quote from the Gateway API. */
export interface QuoteParams {
  srcChain: string;
  dstChain: string;
  srcToken: string;
  dstToken: string;
  amount: string;
  sender?: string;
  recipient: string;
  slippage: string;
}

/** Normalized EVM order, used by swap_to_btc after quote+order creation. */
export interface GatewayEvmOrder {
  orderId: string;
  tx: { to: Hex; data: Hex; value: bigint };
  type: "offramp" | "layerZero";
  expectedBtcOutput: string;
}

/** Chain transaction info returned by the Gateway API. */
interface ChainTxInfo {
  chain: string;
  token: string;
  amount: string;
  txHash: string | null;
}

/** Order status, used by get_orders. */
export interface GatewayOrderStatus {
  timestamp: number;
  status: unknown;
  srcInfo: ChainTxInfo;
  dstInfo: ChainTxInfo;
  estimatedTimeSecs: number | null;
}

/** A supported route returned by the Gateway API. */
export interface RouteInfo {
  srcChain: string;
  srcToken: string;
  dstChain: string;
  dstToken: string;
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB
const ROUTES_CACHE_TTL_MS = 300_000; // 5 minutes

export const BOB_GATEWAY_BASE_URL = "https://gateway-api-mainnet.gobob.xyz";

/**
 * Client for the BOB Gateway API that normalizes responses into flat, typed structures.
 */
export class GatewayClient {
  private routesCache: { routes: RouteInfo[]; fetchedAt: number } | null = null;

  /**
   * Creates a new GatewayClient instance.
   *
   * @param baseUrl - Base URL for the Gateway API
   * @param affiliateId - Optional affiliate ID for tracking volume
   */
  constructor(
    private readonly baseUrl: string = BOB_GATEWAY_BASE_URL,
    private readonly affiliateId?: string,
  ) {}

  /**
   * Creates an EVM swap order (offramp or layerZero) by fetching a quote and creating an order.
   *
   * @param params - Quote parameters for the swap
   * @returns Normalized EVM order with transaction data
   */
  async createEvmOrder(params: QuoteParams): Promise<GatewayEvmOrder> {
    const quote = await this.get("/v1/get-quote", params);

    const type = "offramp" in quote ? ("offramp" as const) : ("layerZero" as const);
    const q = quote[type];

    // Validate quote echoes back our request params (offramp echoes sender/recipient)
    if (type === "offramp") {
      if (q.sender !== params.sender || q.recipient !== params.recipient) {
        throw new Error("Quote response does not match request parameters");
      }
    }

    const order = await this.post("/v1/create-order", quote);
    const inner = order[type];

    const value = BigInt(inner.tx.value);
    if (value < 0n) {
      throw new Error("Invalid transaction value: must be non-negative");
    }

    return {
      orderId: inner.order_id,
      tx: {
        to: inner.tx.to,
        data: inner.tx.data,
        value,
      },
      type,
      expectedBtcOutput: quote[type].outputAmount.amount,
    };
  }

  /**
   * Registers an on-chain transaction hash with the Gateway API.
   *
   * @param orderId - The order UUID to register against
   * @param txHash - The EVM transaction hash
   * @param type - The order type (offramp or layerZero)
   */
  async registerTx(orderId: string, txHash: string, type: "offramp" | "layerZero"): Promise<void> {
    await this.patch("/v1/register-tx", {
      [type]: { order_id: orderId, evm_txhash: txHash },
    });
  }

  /**
   * Fetches the status of a single Gateway order by ID, BTC tx ID, or EVM tx hash.
   *
   * @param id - Order ID, Bitcoin tx ID, or EVM tx hash
   * @returns Normalized order status
   */
  async getOrderStatus(id: string): Promise<GatewayOrderStatus> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await this.get(`/v1/get-order/${encodeURIComponent(id)}`);
    return this.normalizeOrderInfo(info);
  }

  /**
   * Fetches all orders for a given user address.
   *
   * @param userAddress - The EVM address to fetch orders for
   * @returns Array of normalized order statuses
   */
  async getOrdersByAddress(userAddress: string): Promise<GatewayOrderStatus[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders: any[] = await this.get(`/v1/get-orders/${encodeURIComponent(userAddress)}`);
    return orders.map(info => this.normalizeOrderInfo(info));
  }

  /**
   * Normalizes a raw Gateway order info object into a typed status.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeOrderInfo(info: any): GatewayOrderStatus {
    return {
      timestamp: info.timestamp,
      status: info.status,
      srcInfo: {
        chain: info.srcInfo.chain,
        token: info.srcInfo.token,
        amount: info.srcInfo.amount,
        txHash: info.srcInfo.txHash ?? null,
      },
      dstInfo: {
        chain: info.dstInfo.chain,
        token: info.dstInfo.token,
        amount: info.dstInfo.amount,
        txHash: info.dstInfo.txHash ?? null,
      },
      estimatedTimeSecs: info.estimatedTimeInSecs ?? null,
    };
  }

  /**
   * Fetches supported routes from the Gateway API, with a 5-minute cache.
   *
   * @returns Array of supported routes
   */
  async getRoutes(): Promise<RouteInfo[]> {
    if (this.routesCache && Date.now() - this.routesCache.fetchedAt < ROUTES_CACHE_TTL_MS) {
      return this.routesCache.routes;
    }

    const routes: RouteInfo[] = await this.get("/v1/get-routes");
    this.routesCache = { routes, fetchedAt: Date.now() };
    return routes;
  }

  /**
   * Wraps fetch with an AbortController timeout.
   *
   * @param url - The URL to fetch
   * @param init - Optional fetch init options
   * @returns The fetch Response
   */
  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sends a GET request to the Gateway API.
   *
   * @param path - API endpoint path
   * @param queryParams - Optional query parameters
   * @returns Parsed JSON response
   */
  private async get(
    path: string,
    queryParams?: Record<string, string> | QuoteParams,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const entries = Object.entries(queryParams).filter(([, v]) => v != null && v !== "") as [
        string,
        string,
      ][];
      const params = new URLSearchParams(entries);
      if (this.affiliateId) params.set("affiliateId", this.affiliateId);
      url += `?${params}`;
    }
    return this.handleResponse(await this.fetchWithTimeout(url));
  }

  /**
   * Sends a POST request to the Gateway API.
   *
   * @param path - API endpoint path
   * @param body - Request body to serialize as JSON
   * @returns Parsed JSON response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async post(path: string, body: unknown): Promise<any> {
    return this.handleResponse(
      await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  /**
   * Sends a PATCH request to the Gateway API.
   *
   * @param path - API endpoint path
   * @param body - Request body to serialize as JSON
   */
  private async patch(path: string, body: unknown): Promise<void> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 200);
      throw new Error(`Gateway API error (${response.status}): ${errorBody}`);
    }
  }

  /**
   * Checks response status and parses JSON, throwing on errors.
   *
   * @param response - Fetch response to handle
   * @returns Parsed JSON response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 200);
      throw new Error(`Gateway API error (${response.status}): ${errorBody}`);
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error("Gateway API response exceeds size limit");
    }
    return JSON.parse(text);
  }
}
