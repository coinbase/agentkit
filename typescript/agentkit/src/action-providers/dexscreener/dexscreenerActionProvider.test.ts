import { dexscreenerActionProvider } from "./dexscreenerActionProvider";

describe("DexscreenerActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = dexscreenerActionProvider();

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("getPairsByChainAndPair", () => {
    it("should return token pairs when API call is successful", async () => {
      const mockResponse = {
        pairs: [{ chainId: "solana", pairAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }],
      };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.getPairsByChainAndPair({ chainId: "solana", pairId: "So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" });
      expect(result).toEqual(JSON.stringify(mockResponse.pairs));
    });

    it("should throw an error when API response is not ok", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      await expect(provider.getPairsByChainAndPair({ chainId: "solana", pairId: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }))
        .rejects.toThrow("HTTP error! status: 404");
    });

    it("should throw an error when no pairs are found", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ pairs: [] }) });
      await expect(provider.getPairsByChainAndPair({ chainId: "solana", pairId: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }))
        .rejects.toThrow("No pairs found for chainId: solana / pairId: JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
    });
  });

  describe("getTokenPairsByTokenAddress", () => {
    it("should return token pairs when API call is successful", async () => {
      const mockResponse = [{ chainId: "solana", pairAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }];
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.getTokenPairsByTokenAddress({ chainId: "solana", tokenAddresses: ["So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] });
      expect(result).toEqual(JSON.stringify(mockResponse));
    });

    it("should throw an error when API response is not ok", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      await expect(provider.getTokenPairsByTokenAddress({ chainId: "solana", tokenAddresses: ["So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] }))
        .rejects.toThrow("HTTP error! status: 500");
    });
  });

  describe("searchPairs", () => {
    it("should return token pairs matching query", async () => {
      const mockResponse = { 
        pairs: [{ chainId: "solana", pairAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }] 
      };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.searchPairs({ query: "SOL/USDC" });
      expect(result).toEqual(JSON.stringify(mockResponse.pairs));
    });

    it("should throw an error when API response is not ok", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403 });
      await expect(provider.searchPairs({ query: "SOL/USDC" }))
        .rejects.toThrow("HTTP error! status: 403");
    });

    it("should throw an error when no token pairs are found", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ pairs: [] }) });
      await expect(provider.searchPairs({ query: "SOL/USDC" }))
        .rejects.toThrow("No token pair found for SOL/USDC");
    });
  })
});
