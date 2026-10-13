import { GatewayClient, BOB_GATEWAY_BASE_URL, QuoteParams } from "./gatewayClient";

const BASE_URL = "https://gateway-api-mainnet.gobob.xyz";

const MOCK_QUOTE_PARAMS: QuoteParams = {
  srcChain: "base",
  dstChain: "bitcoin",
  srcToken: "0xtoken",
  dstToken: "BTC",
  amount: "100000000",
  sender: "0xsender",
  recipient: "bc1qtest",
  slippage: "300",
};

const MOCK_OFFRAMP_QUOTE = {
  offramp: {
    inputAmount: { amount: "100000000", address: "0xtoken", chain: "base" },
    outputAmount: { amount: "95000", address: "BTC", chain: "bitcoin" },
    fees: { amount: "5000", address: "BTC", chain: "bitcoin" },
    srcChain: "base",
    tokenAddress: "0xtoken",
    sender: "0xsender",
    recipient: "bc1qtest",
    slippage: 300,
    txTo: "0xsender",
  },
};

const MOCK_LZ_QUOTE = {
  layerZero: {
    inputAmount: { amount: "100000000", address: "0xtoken", chain: "base" },
    outputAmount: { amount: "95000", address: "BTC", chain: "bitcoin" },
    fees: { amount: "5000", address: "BTC", chain: "bitcoin" },
    tx: {
      to: "0x0000000000000000000000000000000000000002",
      data: "0x1234",
      value: "50000",
    },
  },
};

const MOCK_OFFRAMP_ORDER = {
  offramp: {
    order_id: "offramp-order-123",
    tx: {
      to: "0x0000000000000000000000000000000000000001",
      data: "0xabcd",
      value: "0",
    },
  },
};

const MOCK_LZ_ORDER = {
  layerZero: {
    order_id: "lz-order-456",
    tx: {
      to: "0x0000000000000000000000000000000000000002",
      data: "0x1234",
      value: "50000",
    },
  },
};

/**
 * Creates a mock successful fetch Response.
 *
 * @param data - The data to return from json()
 * @returns A mock Response object
 */
function mockFetchResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

/**
 * Creates a mock error fetch Response.
 *
 * @param status - HTTP status code
 * @param body - Error body text
 * @returns A mock Response object
 */
function mockFetchError(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as Response;
}

describe("GatewayClient", () => {
  let client: GatewayClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: jest.SpyInstance<any, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());
    client = new GatewayClient();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe("constructor", () => {
    it("uses default base URL", () => {
      expect(BOB_GATEWAY_BASE_URL).toBe(BASE_URL);
    });
  });

  describe("createEvmOrder", () => {
    it("normalizes offramp quotes/orders correctly", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_QUOTE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_ORDER));

      const result = await client.createEvmOrder(MOCK_QUOTE_PARAMS);

      expect(result).toEqual({
        orderId: "offramp-order-123",
        tx: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0xabcd",
          value: BigInt("0"),
        },
        type: "offramp",
        expectedBtcOutput: "95000",
      });
    });

    it("normalizes layerZero quotes/orders correctly", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LZ_QUOTE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_LZ_ORDER));

      const result = await client.createEvmOrder(MOCK_QUOTE_PARAMS);

      expect(result).toEqual({
        orderId: "lz-order-456",
        tx: {
          to: "0x0000000000000000000000000000000000000002",
          data: "0x1234",
          value: BigInt("50000"),
        },
        type: "layerZero",
        expectedBtcOutput: "95000",
      });
    });

    it("passes correct params to get-quote and create-order API endpoints", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_QUOTE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_ORDER));

      await client.createEvmOrder(MOCK_QUOTE_PARAMS);

      // First call: GET /v1/get-quote with query params
      const quoteCall = fetchMock.mock.calls[0];
      const quoteUrl = new URL(quoteCall[0]);
      expect(quoteUrl.origin + quoteUrl.pathname).toBe(`${BASE_URL}/v1/get-quote`);
      expect(quoteUrl.searchParams.get("srcChain")).toBe("base");
      expect(quoteUrl.searchParams.get("dstChain")).toBe("bitcoin");
      expect(quoteUrl.searchParams.get("srcToken")).toBe("0xtoken");
      expect(quoteUrl.searchParams.get("dstToken")).toBe("BTC");
      expect(quoteUrl.searchParams.get("amount")).toBe("100000000");
      expect(quoteUrl.searchParams.get("sender")).toBe("0xsender");
      expect(quoteUrl.searchParams.get("recipient")).toBe("bc1qtest");
      expect(quoteUrl.searchParams.get("slippage")).toBe("300");

      // Second call: POST /v1/create-order with the quote as body
      const orderCall = fetchMock.mock.calls[1];
      expect(orderCall[0]).toBe(`${BASE_URL}/v1/create-order`);
      expect(orderCall[1]).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(MOCK_OFFRAMP_QUOTE),
        }),
      );
    });

    it("includes affiliateId in quote URL when configured", async () => {
      const clientWithAffiliate = new GatewayClient(BOB_GATEWAY_BASE_URL, "my-affiliate");
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_QUOTE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_ORDER));

      await clientWithAffiliate.createEvmOrder(MOCK_QUOTE_PARAMS);

      const quoteUrl = new URL(fetchMock.mock.calls[0][0]);
      expect(quoteUrl.searchParams.get("affiliateId")).toBe("my-affiliate");
    });

    it("rejects quote with mismatched sender", async () => {
      const tamperedQuote = {
        offramp: {
          ...MOCK_OFFRAMP_QUOTE.offramp,
          sender: "0xattacker",
        },
      };
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(tamperedQuote))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_ORDER));

      await expect(client.createEvmOrder(MOCK_QUOTE_PARAMS)).rejects.toThrow(
        "Quote response does not match request",
      );
    });
  });

  describe("response validation", () => {
    it("rejects negative tx.value in createEvmOrder", async () => {
      const badOrder = {
        offramp: {
          order_id: "order-123",
          tx: { to: "0x0000000000000000000000000000000000000001", data: "0xabcd", value: "-1" },
        },
      };
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_QUOTE))
        .mockResolvedValueOnce(mockFetchResponse(badOrder));

      await expect(client.createEvmOrder(MOCK_QUOTE_PARAMS)).rejects.toThrow(
        "Invalid transaction value",
      );
    });
  });

  describe("registerTx", () => {
    it("sends correct PATCH body for offramp type", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      } as Response);

      await client.registerTx("order-123", "0xtxhash", "offramp");

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/v1/register-tx`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offramp: { order_id: "order-123", evm_txhash: "0xtxhash" },
          }),
        }),
      );
    });

    it("sends correct PATCH body for layerZero type", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      } as Response);

      await client.registerTx("order-456", "0xtxhash2", "layerZero");

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/v1/register-tx`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layerZero: { order_id: "order-456", evm_txhash: "0xtxhash2" },
          }),
        }),
      );
    });
  });

  describe("getOrderStatus", () => {
    const MOCK_SUCCESS_ORDER = {
      timestamp: 1700000000,
      srcInfo: { chain: "bitcoin", token: "BTC", amount: "1000000", txHash: "0xsrchash" },
      dstInfo: { chain: "bob", token: "0xtoken", amount: "990000", txHash: "0xdsthash" },
      status: "success",
      estimatedTimeInSecs: null,
    };

    const MOCK_IN_PROGRESS_ORDER = {
      timestamp: 1700000100,
      srcInfo: { chain: "base", token: "0xusdc", amount: "500000", txHash: "0xsrc" },
      dstInfo: { chain: "bitcoin", token: "BTC", amount: "48000", txHash: null },
      status: { inProgress: { bump_fee_tx: null, refund_tx: null } },
      estimatedTimeInSecs: 1200,
    };

    it("normalizes a successful order", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(MOCK_SUCCESS_ORDER));

      const result = await client.getOrderStatus("order-123");

      expect(result).toEqual({
        timestamp: 1700000000,
        status: "success",
        srcInfo: { chain: "bitcoin", token: "BTC", amount: "1000000", txHash: "0xsrchash" },
        dstInfo: { chain: "bob", token: "0xtoken", amount: "990000", txHash: "0xdsthash" },
        estimatedTimeSecs: null,
      });
    });

    it("passes through object status as-is", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(MOCK_IN_PROGRESS_ORDER));

      const result = await client.getOrderStatus("order-456");

      expect(result.status).toEqual({ inProgress: { bump_fee_tx: null, refund_tx: null } });
      expect(result.estimatedTimeSecs).toBe(1200);
    });

    it("passes through string status as-is", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ ...MOCK_SUCCESS_ORDER, status: "refunded" }),
      );

      const result = await client.getOrderStatus("order-refund");
      expect(result.status).toBe("refunded");
    });

    it("encodes orderId to prevent path traversal", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(MOCK_SUCCESS_ORDER));

      await client.getOrderStatus("../../admin/secret");

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toBe(`${BASE_URL}/v1/get-order/..%2F..%2Fadmin%2Fsecret`);
    });

    it("aborts fetch after timeout", async () => {
      jest.useFakeTimers();

      fetchMock.mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          }),
      );

      const promise = client.getOrderStatus("order-123").catch((e: Error) => e);

      await jest.advanceTimersByTimeAsync(30_000);

      const result = await promise;
      expect(result).toBeDefined();
      expect((result as DOMException).name).toBe("AbortError");

      jest.useRealTimers();
    }, 10000);

    it("passes through unknown status strings from API", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ ...MOCK_SUCCESS_ORDER, status: "preminted" }),
      );

      const result = await client.getOrderStatus("order-x");
      expect(result.status).toBe("preminted");
    });

    it("passes through unknown object status as-is", async () => {
      const orderWithObjectStatus = {
        ...MOCK_SUCCESS_ORDER,
        status: { someNewStatus: { detail: "info" } },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(orderWithObjectStatus));

      const result = await client.getOrderStatus("order-y");
      expect(result.status).toEqual({ someNewStatus: { detail: "info" } });
    });
  });

  describe("getOrdersByAddress", () => {
    it("fetches and normalizes all orders for an address", async () => {
      const mockOrders = [
        {
          timestamp: 1700000000,
          srcInfo: { chain: "base", token: "USDC", amount: "100", txHash: "0xabc" },
          dstInfo: { chain: "bitcoin", token: "BTC", amount: "0.001", txHash: "btctx1" },
          status: "success",
          estimatedTimeInSecs: null,
        },
        {
          timestamp: 1700000100,
          srcInfo: { chain: "base", token: "WBTC", amount: "0.5", txHash: "0xdef" },
          dstInfo: { chain: "bitcoin", token: "BTC", amount: "0.49", txHash: null },
          status: "inProgress",
          estimatedTimeInSecs: 300,
        },
      ];
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockOrders));

      const results = await client.getOrdersByAddress("0xuser123");

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("inProgress");
      expect(results[1].estimatedTimeSecs).toBe(300);

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toBe(`${BASE_URL}/v1/get-orders/0xuser123`);
    });
  });

  describe("getRoutes", () => {
    const MOCK_ROUTES = [
      { srcChain: "base", srcToken: "0xusdc", dstChain: "bitcoin", dstToken: "BTC" },
      { srcChain: "bitcoin", srcToken: "BTC", dstChain: "bob", dstToken: "0xwbtc" },
    ];

    it("fetches routes from the API", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(MOCK_ROUTES));

      const routes = await client.getRoutes();

      expect(routes).toEqual(MOCK_ROUTES);
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toBe(`${BASE_URL}/v1/get-routes`);
    });

    it("caches routes on subsequent calls", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(MOCK_ROUTES));

      await client.getRoutes();
      const routes2 = await client.getRoutes();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(routes2).toEqual(MOCK_ROUTES);
    });
  });

  describe("error handling", () => {
    it("throws on non-ok HTTP response from GET", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"));

      await expect(client.createEvmOrder(MOCK_QUOTE_PARAMS)).rejects.toThrow(
        "Gateway API error (500): Internal Server Error",
      );
    });

    it("throws on non-ok HTTP response from POST", async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(MOCK_OFFRAMP_QUOTE))
        .mockResolvedValueOnce(mockFetchError(400, "Bad Request"));

      await expect(client.createEvmOrder(MOCK_QUOTE_PARAMS)).rejects.toThrow(
        "Gateway API error (400): Bad Request",
      );
    });

    it("throws on non-ok HTTP response from PATCH", async () => {
      fetchMock.mockResolvedValueOnce(mockFetchError(403, "Forbidden"));

      await expect(client.registerTx("order-123", "0xtxhash", "offramp")).rejects.toThrow(
        "Gateway API error (403): Forbidden",
      );
    });
  });
});
