import { defillamaActionProvider } from "./defillamaActionProvider";
import { Protocol } from "./types";

describe("DefiLlamaActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = defillamaActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("getTokenPrices", () => {
    it("should return token prices when API call is successful", async () => {
      const mockResponse = {
        "ethereum:0x1234": { price: 1800 },
      };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.getTokenPrices({
        tokens: ["ethereum:0x1234"],
      });
      expect(JSON.parse(result)).toEqual(mockResponse);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      const result = await provider.getTokenPrices({
        tokens: ["ethereum:0x1234"],
      });
      expect(result).toContain("Error fetching token prices");
    });

    it("should handle network errors", async () => {
      const error = new Error("Network error");
      fetchMock.mockRejectedValue(error);

      const result = await provider.getTokenPrices({
        tokens: ["ethereum:0x1234"],
      });
      expect(result).toContain("Error fetching token prices");
      expect(result).toContain("Network error");
    });
  });

  describe("getProtocol", () => {
    const mockProtocol: Protocol = {
      name: "Uniswap",
      symbol: "UNI",
      description: "Decentralized exchange protocol",
      category: "DEX",
      chain: "Ethereum",
      tvl: 1000000,
      url: "https://uniswap.org",
      logo: "https://example.com/logo.png",
    };

    it("should return protocol information when API call is successful", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockProtocol) });

      const result = await provider.getProtocol({ protocolId: "uniswap" });
      expect(JSON.parse(result)).toEqual(mockProtocol);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.getProtocol({ protocolId: "invalid-protocol" });
      expect(result).toContain("Error fetching protocol information");
      expect(result).toContain("500");
    });

    it("should handle empty response", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(null) });
      const result = await provider.getProtocol({ protocolId: "non-existent" });
      expect(JSON.parse(result)).toEqual(null);
    });
  });

  describe("searchProtocols", () => {
    const mockProtocols: Protocol[] = [
      {
        name: "Uniswap",
        symbol: "UNI",
        category: "DEX",
        chain: "Ethereum",
        tvl: 1000000,
      },
      {
        name: "UniswapV3",
        symbol: "UNI",
        category: "DEX",
        chain: "Ethereum",
        tvl: 2000000,
      },
    ];

    it("should return matching protocols", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockProtocols) });

      const result = await provider.searchProtocols({ query: "uniswap" });
      expect(JSON.parse(result)).toEqual(mockProtocols);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });
      const result = await provider.searchProtocols({ query: "uniswap" });
      expect(result).toContain("Error searching protocols");
      expect(result).toContain("429");
    });

    it("should handle empty search results", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue([]) });
      const result = await provider.searchProtocols({ query: "nonexistentprotocol" });
      expect(result).toContain('No protocols found matching "nonexistentprotocol"');
    });

    it("should handle malformed response", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: "response" }),
      });
      const result = await provider.searchProtocols({ query: "uniswap" });
      expect(result).toContain("Error searching protocols");
    });

    it("should filter protocols case-insensitively", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockProtocols) });

      const result = await provider.searchProtocols({ query: "UNISWAP" });
      expect(JSON.parse(result)).toEqual(mockProtocols);
    });
  });
});
