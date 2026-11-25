import { dexraActionProvider, DexraActionProvider } from "./dexraActionProvider";
import { NewLaunchesSchema, SwapPreflightSchema, TokenDeepCheckSchema } from "./schemas";

const MINT = "So11111111111111111111111111111111111111112";
const WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

const MOCK_RESULT = {
  verdict: "caution",
  reasons: ["mint authority is active"],
  summary: "Caution: mint authority is active.",
};

/**
 * Builds a mocked fetch response.
 *
 * @param status - HTTP status
 * @param body - Response body text
 * @param headers - Response headers
 * @returns A Response-like object
 */
function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe("DexraActionProvider", () => {
  let provider: DexraActionProvider;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.DEXRA_API_KEY;
    provider = dexraActionProvider();
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEXRA_API_KEY;
  });

  describe("schemas", () => {
    it("accepts a Solana mint", () => {
      expect(TokenDeepCheckSchema.safeParse({ mint: MINT }).success).toBe(true);
    });

    it("rejects an address of the wrong length", () => {
      expect(TokenDeepCheckSchema.safeParse({ mint: "abc" }).success).toBe(false);
    });

    it("bounds the launch window and limit", () => {
      expect(NewLaunchesSchema.safeParse({ minutes: 1441 }).success).toBe(false);
      expect(NewLaunchesSchema.safeParse({ limit: 21 }).success).toBe(false);
      expect(NewLaunchesSchema.safeParse({}).success).toBe(true);
    });

    it("requires a positive swap amount and a side", () => {
      expect(SwapPreflightSchema.safeParse({ mint: MINT, side: "buy", amount: 0 }).success).toBe(
        false,
      );
      expect(SwapPreflightSchema.safeParse({ mint: MINT, side: "hold", amount: 1 }).success).toBe(
        false,
      );
    });
  });

  describe("calls", () => {
    it("returns the result of a free check without an API key", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: { type: "token" } })));

      const response = await provider.describeAddress({ address: MINT });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.dexra.dev/describe_address?address=${MINT}`);
      expect(options.headers).not.toHaveProperty("Authorization");
      expect(JSON.parse(response)).toEqual({ type: "token" });
    });

    it("sends the API key as a bearer token", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: MOCK_RESULT })));

      const keyed = dexraActionProvider({ apiKey: "dxr_test" });
      const response = await keyed.tokenDeepCheck({ mint: MINT });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.dexra.dev/token_deep_check?mint=${MINT}`);
      expect(options.headers.Authorization).toBe("Bearer dxr_test");
      expect(JSON.parse(response)).toEqual(MOCK_RESULT);
    });

    it("reads the API key from DEXRA_API_KEY", async () => {
      process.env.DEXRA_API_KEY = "dxr_env";
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: MOCK_RESULT })));

      await dexraActionProvider().walletCheck({ address: WALLET });

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer dxr_env");
    });

    it("maps launch filters to query parameters and leaves out unset ones", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: [] })));

      await provider.newLaunches({
        minutes: 30,
        minLiquidityUsd: 5000,
        platforms: ["pump_fun", "letsbonk"],
      });

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe("/new_launches");
      expect(url.searchParams.get("minutes")).toBe("30");
      expect(url.searchParams.get("min_liquidity_usd")).toBe("5000");
      expect(url.searchParams.get("platforms")).toBe("pump_fun,letsbonk");
      expect(url.searchParams.has("limit")).toBe(false);
      expect(url.searchParams.has("include_collapsed")).toBe(false);
    });

    it("passes the swap to swap_preflight", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: MOCK_RESULT })));

      await provider.swapPreflight({ mint: MINT, side: "sell", amount: 1.5 });

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe("/swap_preflight");
      expect(url.searchParams.get("side")).toBe("sell");
      expect(url.searchParams.get("amount")).toBe("1.5");
      expect(url.searchParams.has("quote")).toBe(false);
    });

    it("calls pool_health with the pool address", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ result: MOCK_RESULT })));

      await provider.poolHealth({ pool: WALLET });

      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.dexra.dev/pool_health?pool=${WALLET}`);
    });
  });

  describe("errors", () => {
    it("explains how to pay when a paid check answers 402", async () => {
      const required = Buffer.from(
        JSON.stringify({ x402Version: 2, accepts: [{ scheme: "exact", amount: "30000" }] }),
      ).toString("base64");
      fetchMock.mockResolvedValue(mockResponse(402, "", { "payment-required": required }));

      const response = await provider.walletCheck({ address: WALLET });

      expect(response).toContain("no DEXRA_API_KEY is set");
      expect(response).toContain("0.03 USDC");
      expect(response).toContain("make_http_request_with_x402");
      expect(response).toContain(`https://api.dexra.dev/wallet_check?address=${WALLET}`);
    });

    it("still explains how to pay when the 402 has no readable price", async () => {
      fetchMock.mockResolvedValue(mockResponse(402, ""));

      const response = await dexraActionProvider({ apiKey: "dxr_test" }).walletCheck({
        address: WALLET,
      });

      expect(response).toContain("no credits left");
      expect(response).toContain("make_http_request_with_x402");
    });

    it("returns the API error for a bad request", async () => {
      fetchMock.mockResolvedValue(
        mockResponse(400, JSON.stringify({ error: "invalid_request", context: "bad address" })),
      );

      const response = await provider.describeAddress({ address: WALLET });

      expect(response).toContain("HTTP 400");
      expect(response).toContain("bad address");
    });

    it("returns an error message when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));

      const response = await provider.describeAddress({ address: WALLET });

      expect(response).toBe("Error calling Dexra describe_address: network down");
    });
  });

  describe("supportsNetwork", () => {
    it("supports Solana mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
    });

    it("does not support other networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-devnet" })).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        false,
      );
    });
  });
});
