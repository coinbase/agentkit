import { EzPathActionProvider } from "./ezpathActionProvider";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS  = "0x48Ccd1fF2903483B12298760eA9b5D6106E999E9";
const MOCK_SIG      = "0x" + "ab".repeat(65);
const TOLL_ADDRESS  = "0x13dDE704389b1118B20d2BCc6D3Ace749600e2ad";
const USDC          = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH          = "0x4200000000000000000000000000000000000006";

const PROBE_BODY = {
  tiers: {
    basic:         { min_atomic: "30000",  min_usdc: 0.03 },
    resilient:     { min_atomic: "100000", min_usdc: 0.10 },
    institutional: { min_atomic: "500000", min_usdc: 0.50 },
  },
};

const QUOTE_BODY = {
  request_id:       "a1b2c3d4-0000-0000-0000-000000000001",
  sellToken:        USDC,
  buyToken:         WETH,
  sellAmount:       "1000000",
  buyAmount:        "449123456789012",
  price:            "0.000449",
  sources:          [{ name: "Native_V2", proportion: "1" }],
  routingEngine:    "0x",
  tier:             "basic",
  routing_metadata: { execution_mode: "direct", winner: "0x" },
};

function mockWalletProvider() {
  return {
    getAddress:    jest.fn().mockResolvedValue(MOCK_ADDRESS),
    signTypedData: jest.fn().mockResolvedValue(MOCK_SIG),
  };
}

function mockFetch(...responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const r = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      status:  r.status,
      ok:      r.status >= 200 && r.status < 300,
      json:    () => Promise.resolve(r.body),
      headers: { get: (k: string) => (r.headers ?? {})[k] ?? null },
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EzPathActionProvider", () => {
  let provider: EzPathActionProvider;
  let wallet:   ReturnType<typeof mockWalletProvider>;

  beforeEach(() => {
    provider = new EzPathActionProvider();
    wallet   = mockWalletProvider();
  });

  afterEach(() => jest.restoreAllMocks());

  // ── supportsNetwork ────────────────────────────────────────────────────────

  describe("supportsNetwork", () => {
    it("returns true for Base mainnet (chainId 8453)", () => {
      expect(provider.supportsNetwork({ chainId: "8453", protocolFamily: "evm" } as never)).toBe(true);
    });

    it("returns false for other chains", () => {
      expect(provider.supportsNetwork({ chainId: "1",    protocolFamily: "evm" } as never)).toBe(false);
      expect(provider.supportsNetwork({ chainId: "137",  protocolFamily: "evm" } as never)).toBe(false);
    });
  });

  // ── getSwapQuote — happy path ──────────────────────────────────────────────

  describe("getSwapQuote", () => {
    it("returns formatted quote on success (basic tier)", async () => {
      global.fetch = mockFetch(
        { status: 402, body: PROBE_BODY, headers: { "X-402-Address": TOLL_ADDRESS } },
        { status: 200, body: QUOTE_BODY, headers: { "X-Settlement-Tx": "0xabc123", "X-Routing-Engine": "0x" } },
      );

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken:  USDC,
        buyToken:   WETH,
        sellAmount: "1000000",
        tier:       "basic",
      });

      expect(result).toContain("EZ-Path quote received.");
      expect(result).toContain("tier=basic");
      expect(result).toContain("winner=0x");
      expect(result).toContain("mode=direct");
      expect(result).toContain("price=0.000449");
      expect(result).toContain("settlement_tx=0xabc123");
    });

    it("includes race_comparison for resilient tier", async () => {
      const resilientBody = {
        ...QUOTE_BODY,
        tier: "resilient",
        routing_metadata: {
          execution_mode:  "concurrent_race",
          winner:          "0x",
          race_comparison: {
            lane_1_aggregator_out: "449123456789012",
            lane_2_aerodrome_out:  "0",
          },
        },
      };

      global.fetch = mockFetch(
        { status: 402, body: PROBE_BODY, headers: { "X-402-Address": TOLL_ADDRESS } },
        { status: 200, body: resilientBody, headers: {} },
      );

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken:  USDC,
        buyToken:   WETH,
        sellAmount: "1000000",
        tier:       "resilient",
      });

      expect(result).toContain("mode=concurrent_race");
      expect(result).toContain("lane_1=449123456789012");
    });

    it("passes slippagePercentage as query param when provided", async () => {
      global.fetch = mockFetch(
        { status: 402, body: PROBE_BODY, headers: { "X-402-Address": TOLL_ADDRESS } },
        { status: 200, body: QUOTE_BODY, headers: {} },
      );

      await provider.getSwapQuote(wallet as never, {
        sellToken:          USDC,
        buyToken:           WETH,
        sellAmount:         "1000000",
        tier:               "basic",
        slippagePercentage: 0.01,
      });

      const firstCall = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain("slippagePercentage=0.01");
    });
  });

  // ── getSwapQuote — error paths ─────────────────────────────────────────────

  describe("getSwapQuote error handling", () => {
    it("returns rate-limit message on 429 during probe", async () => {
      global.fetch = mockFetch({
        status: 429, body: {}, headers: { "Retry-After": "30" },
      });

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("Rate limited");
      expect(result).toContain("30");
    });

    it("returns error if 402 is missing X-402-Address header", async () => {
      global.fetch = mockFetch({ status: 402, body: PROBE_BODY, headers: {} });

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("missing X-402-Address");
    });

    it("returns signing error if signTypedData throws", async () => {
      global.fetch = mockFetch(
        { status: 402, body: PROBE_BODY, headers: { "X-402-Address": TOLL_ADDRESS } },
      );
      wallet.signTypedData.mockRejectedValue(new Error("user rejected"));

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("EIP-3009 signing failed");
      expect(result).toContain("user rejected");
    });

    it("returns rejection message on 401 from paid request", async () => {
      global.fetch = mockFetch(
        { status: 402, body: PROBE_BODY,                          headers: { "X-402-Address": TOLL_ADDRESS } },
        { status: 401, body: { reason: "invalid_signature" },     headers: {} },
      );

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("rejected payment signature");
      expect(result).toContain("invalid_signature");
    });

    it("returns error message on unexpected probe status", async () => {
      global.fetch = mockFetch({ status: 500, body: {}, headers: {} });

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("Unexpected response");
      expect(result).toContain("500");
    });

    it("returns network error message if fetch throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network failure"));

      const result = await provider.getSwapQuote(wallet as never, {
        sellToken: USDC, buyToken: WETH, sellAmount: "1000000", tier: "basic",
      });

      expect(result).toContain("EZ-Path unavailable");
      expect(result).toContain("network failure");
    });
  });
});
