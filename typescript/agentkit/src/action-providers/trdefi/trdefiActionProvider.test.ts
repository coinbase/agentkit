import { trdefiActionProvider } from "./trdefiActionProvider";

describe("TrdefiActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = trdefiActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("listChains", () => {
    it("should return chains when API call is successful", async () => {
      const mockResponse = {
        chains: [{ key: "base", name: "Base", chain_id: 8453 }],
      };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.listChains();
      expect(JSON.parse(result)).toEqual(mockResponse);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.listChains();
      expect(result).toContain("Error listing chains");
    });

    it("should handle network errors", async () => {
      const error = new Error("Network error");
      fetchMock.mockRejectedValue(error);

      const result = await provider.listChains();
      expect(result).toContain("Error listing chains");
      expect(result).toContain("Network error");
    });
  });

  describe("getStats", () => {
    it("should return stats when API call is successful", async () => {
      const mockResponse = { data: { totals: { strategies: 4886 } } };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.getStats();
      expect(JSON.parse(result)).toEqual(mockResponse);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.getStats();
      expect(result).toContain("Error fetching stats");
    });
  });

  describe("listStrategies", () => {
    const mockStrategies = {
      strategies: [{ pair: "USDC/USDT", chain: "base", strategy_hash: "0xabc" }],
      count: 1,
    };

    it("should return strategies when API call is successful", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockStrategies) });

      const result = await provider.listStrategies({ chain: "base", q: null, pair: null });
      expect(JSON.parse(result)).toEqual(mockStrategies);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/strategies?chain=base"));
    });

    it("should include optional filters in the request", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockStrategies) });

      await provider.listStrategies({ chain: "base", q: "USDC", pair: "USDC/USDT" });
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=USDC"));
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      const result = await provider.listStrategies({ chain: "arc", q: null, pair: null });
      expect(result).toContain("Error listing strategies");
    });
  });

  describe("getStrategy", () => {
    it("should return strategy detail when API call is successful", async () => {
      const mockStrategy = { pair: "USDC/USDT", chain: "base" };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockStrategy) });

      const result = await provider.getStrategy({ hash: "0xabc" });
      expect(JSON.parse(result)).toEqual(mockStrategy);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      const result = await provider.getStrategy({ hash: "0xinvalid" });
      expect(result).toContain("Error fetching strategy");
    });
  });

  describe("getQuote", () => {
    it("should return the quote payload when API call is successful", async () => {
      const mockQuote = { data: { outAmount: "999000" } };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockQuote) });

      const result = await provider.getQuote({
        hash: "0xabc",
        chain: "base",
        amount: "1000000",
        direction: "aToB",
      });
      expect(JSON.parse(result)).toEqual(mockQuote);
    });

    it("should surface structured unavailability reasons", async () => {
      const mockReason = { error: "Strategy is gated", detail: "The maker gated this strategy" };
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        json: jest.fn().mockResolvedValue(mockReason),
      });

      const result = await provider.getQuote({
        hash: "0xabc",
        chain: "base",
        amount: "1000000",
        direction: "aToB",
      });
      expect(result).toContain("Strategy is gated");
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.getQuote({
        hash: "0xabc",
        chain: "base",
        amount: "1000000",
        direction: "aToB",
      });
      expect(result).toContain("Error quoting swap");
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
