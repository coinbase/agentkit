import { walletprintActionProvider } from "./walletprintActionProvider";

describe("WalletPrintActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = walletprintActionProvider({ apiKey: "walletprint-dev-key" });

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should support Ethereum mainnet (chainId 1)", () => {
      expect(provider.supportsNetwork({ chainId: "1" } as any)).toBe(true);
    });

    it("should support Base (chainId 8453)", () => {
      expect(provider.supportsNetwork({ chainId: "8453" } as any)).toBe(true);
    });

    it("should not support unsupported chains", () => {
      expect(provider.supportsNetwork({ chainId: "137" } as any)).toBe(false);
    });

    it("should not support networks without chainId", () => {
      expect(provider.supportsNetwork({} as any)).toBe(false);
    });
  });

  describe("scoreTransaction", () => {
    it("should return parsed risk score on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          risk_score: 72,
          band: "high",
          reasons: ["New recipient address", "Amount 4x above 30-day average"],
          recommendation: "escalate",
        }),
      });

      const result = await provider.scoreTransaction({
        to: "0xabc123",
        value_usd: 50000,
        asset: "USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.risk_score).toBe(72);
      expect(parsed.band).toBe("high");
      expect(parsed.reasons).toHaveLength(2);
      expect(parsed.recommendation).toBe("escalate");
    });

    it("should pass contract_category when provided", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          risk_score: 10,
          band: "low",
          reasons: [],
        }),
      });

      await provider.scoreTransaction({
        to: "0xdef456",
        value_usd: 100,
        asset: "ETH",
        contract_category: "erc20",
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.contract_category).toBe("erc20");
    });

    it("should not include contract_category in body when not provided", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ risk_score: 10, band: "low", reasons: [] }),
      });

      await provider.scoreTransaction({
        to: "0xdef456",
        value_usd: 100,
        asset: "ETH",
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.contract_category).toBeUndefined();
    });

    it("should return error on non-ok HTTP response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await provider.scoreTransaction({
        to: "0xabc123",
        value_usd: 500,
        asset: "USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP 401");
    });

    it("should return error on fetch exception", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.scoreTransaction({
        to: "0xabc123",
        value_usd: 500,
        asset: "USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Network error");
    });

    it("should infer recommendation when API omits it", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ risk_score: 55, band: "medium", reasons: ["Unusual timing"] }),
      });

      const result = await provider.scoreTransaction({
        to: "0xabc123",
        value_usd: 1000,
        asset: "USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.recommendation).toBe("review");
    });

    it("should use custom baseUrl when provided", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ risk_score: 5, band: "low", reasons: [] }),
      });

      const customProvider = walletprintActionProvider({
        apiKey: "test-key",
        baseUrl: "https://custom.example.com",
      });
      await customProvider.scoreTransaction({ to: "0x123", value_usd: 10, asset: "ETH" });

      expect(fetchMock.mock.calls[0][0]).toContain("custom.example.com");
    });

    it("should send X-Api-Key header", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ risk_score: 5, band: "low", reasons: [] }),
      });

      await provider.scoreTransaction({ to: "0x123", value_usd: 10, asset: "ETH" });

      expect(fetchMock.mock.calls[0][1].headers["X-Api-Key"]).toBe("walletprint-dev-key");
    });
  });
});
