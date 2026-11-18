import { dexscreenerActionProvider } from "./dexscreenerActionProvider";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_PAIR = {
  chainId: "base",
  dexId: "aerodrome",
  url: "https://dexscreener.com/base/0x88a43bbdf9d098eec7bceda4e2494615dfd9bb9c",
  pairAddress: "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
  baseToken: {
    address: "0x4200000000000000000000000000000000000006",
    name: "Wrapped Ether",
    symbol: "WETH",
  },
  quoteToken: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin",
    symbol: "USDC",
  },
  priceNative: "1800.00",
  priceUsd: "1800.00",
  volume: { h24: 5000000, h6: 1200000, h1: 200000, m5: 15000 },
  priceChange: { h24: 2.5, h6: 0.8, h1: -0.2, m5: 0.1 },
  liquidity: { usd: 12000000, base: 3333, quote: 6000000 },
  fdv: 220000000000,
  marketCap: 210000000000,
  pairCreatedAt: 1700000000000,
};

describe("DexScreenerActionProvider", () => {
  const provider = dexscreenerActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── searchPairs ──────────────────────────────────────────────────

  describe("searchPairs", () => {
    it("should return formatted pairs on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: [MOCK_PAIR] }),
      });

      const result = await provider.searchPairs({ query: "WETH" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(1);
      expect(parsed.pairs[0].pair).toBe("WETH/USDC");
      expect(parsed.pairs[0].priceUsd).toBe("1800.00");
      expect(parsed.pairs[0].chain).toBe("base");
      expect(parsed.pairs[0].dex).toBe("aerodrome");
    });

    it("should return empty list when no pairs found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: [] }),
      });

      const result = await provider.searchPairs({ query: "UNKNOWN_TOKEN_XYZ" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
      expect(parsed.pairs).toEqual([]);
    });

    it("should handle null pairs response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: null }),
      });

      const result = await provider.searchPairs({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
    });

    it("should return error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const result = await provider.searchPairs({ query: "WETH" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("429");
    });

    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.searchPairs({ query: "WETH" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Network error");
    });

    it("should limit results to 10 pairs", async () => {
      const manyPairs = Array.from({ length: 20 }, (_, i) => ({
        ...MOCK_PAIR,
        pairAddress: `0x${i.toString().padStart(40, "0")}`,
        baseToken: { ...MOCK_PAIR.baseToken, symbol: `TOKEN${i}` },
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: manyPairs }),
      });

      const result = await provider.searchPairs({ query: "TOKEN" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(10);
      expect(parsed.pairs).toHaveLength(10);
    });
  });

  // ─── getPairsByToken ──────────────────────────────────────────────

  describe("getPairsByToken", () => {
    it("should return pairs sorted by 24h volume", async () => {
      const lowVolumePair = {
        ...MOCK_PAIR,
        pairAddress: "0xaaa",
        dexId: "uniswap",
        volume: { h24: 100000 },
      };
      const highVolumePair = {
        ...MOCK_PAIR,
        pairAddress: "0xbbb",
        dexId: "aerodrome",
        volume: { h24: 5000000 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [lowVolumePair, highVolumePair],
      });

      const result = await provider.getPairsByToken({
        chainId: "base",
        tokenAddress: "0x4200000000000000000000000000000000000006",
        limit: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.pairs[0].volume24h).toBe(5000000);
      expect(parsed.pairs[1].volume24h).toBe(100000);
    });

    it("should respect the limit parameter", async () => {
      const pairs = Array.from({ length: 10 }, (_, i) => ({
        ...MOCK_PAIR,
        pairAddress: `0x${i.toString().padStart(40, "0")}`,
        volume: { h24: (10 - i) * 1000 },
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => pairs,
      });

      const result = await provider.getPairsByToken({
        chainId: "base",
        tokenAddress: "0x4200000000000000000000000000000000000006",
        limit: 3,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(3);
      expect(parsed.pairs).toHaveLength(3);
    });

    it("should return empty list when token has no pairs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await provider.getPairsByToken({
        chainId: "base",
        tokenAddress: "0x0000000000000000000000000000000000000001",
        limit: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
    });

    it("should return error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await provider.getPairsByToken({
        chainId: "base",
        tokenAddress: "0x0000000000000000000000000000000000000001",
        limit: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("404");
    });

    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await provider.getPairsByToken({
        chainId: "base",
        tokenAddress: "0x4200000000000000000000000000000000000006",
        limit: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Connection refused");
    });
  });

  // ─── getPair ─────────────────────────────────────────────────────

  describe("getPair", () => {
    it("should return pair details from pair field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pair: MOCK_PAIR }),
      });

      const result = await provider.getPair({
        chainId: "base",
        pairAddress: "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.pair.pair).toBe("WETH/USDC");
      expect(parsed.pair.liquidityUsd).toBe(12000000);
      expect(parsed.pair.volume24h).toBe(5000000);
    });

    it("should fallback to pairs array when pair field is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: [MOCK_PAIR] }),
      });

      const result = await provider.getPair({
        chainId: "base",
        pairAddress: "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.pair.pair).toBe("WETH/USDC");
    });

    it("should return error when pair not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pair: null, pairs: [] }),
      });

      const result = await provider.getPair({
        chainId: "base",
        pairAddress: "0x0000000000000000000000000000000000000001",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No pair found");
    });

    it("should return error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await provider.getPair({
        chainId: "base",
        pairAddress: "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("500");
    });

    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Timeout"));

      const result = await provider.getPair({
        chainId: "base",
        pairAddress: "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Timeout");
    });
  });

  // ─── supportsNetwork ─────────────────────────────────────────────

  describe("supportsNetwork", () => {
    it("should support all networks", () => {
      const networks = [
        "base-mainnet",
        "base-sepolia",
        "ethereum-mainnet",
        "solana-mainnet",
        "arbitrum-mainnet",
      ];
      networks.forEach(networkId => {
        expect(provider.supportsNetwork({ networkId } as never)).toBe(true);
      });
    });
  });
});
