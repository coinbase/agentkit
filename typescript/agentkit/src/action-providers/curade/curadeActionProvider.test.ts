import { curadeActionProvider } from "./curadeActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

const mockWallet = {
  getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
  getNetwork: jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId: "base-mainnet",
    chainId: "8453",
  }),
  getName: jest.fn().mockReturnValue("test-wallet"),
  toSigner: jest.fn().mockReturnValue({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    signMessage: jest.fn(),
    signTypedData: jest.fn(),
  }),
} as unknown as EvmWalletProvider;

const fetchMock = jest.fn();

describe("CuradeActionProvider", () => {
  const provider = curadeActionProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe("supportsNetwork", () => {
    it("should support EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should not support non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });

  describe("polymarketOdds", () => {
    it("should call the odds endpoint with query params and return the body", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ market: "fed-rates", yes: 0.61 }]),
      });

      const result = await provider.polymarketOdds({ limit: 5, q: "fed" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.curade.xyz/v1/polymarket/odds?limit=5&q=fed",
      );
      expect(result).toContain("fed-rates");
    });

    it("should omit the query string when no params are given", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "[]",
      });

      await provider.polymarketOdds({});

      expect(fetchMock).toHaveBeenCalledWith("https://api.curade.xyz/v1/polymarket/odds");
    });

    it("should surface the x402 challenge on HTTP 402", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => '{"x402Version":2,"accepts":[]}',
      });

      const result = await provider.polymarketOdds({ limit: 1 });

      expect(result).toContain("Payment required (HTTP 402)");
      expect(result).toContain("x402Version");
    });

    it("should return an error message on HTTP failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "boom",
      });

      const result = await provider.polymarketOdds({});

      expect(result).toContain("Error calling Curade API");
      expect(result).toContain("HTTP 500");
      expect(result).toContain("boom");
    });

    it("should return an error message when fetch rejects", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network down"));

      const result = await provider.polymarketOdds({});

      expect(result).toContain("Error calling Curade API");
      expect(result).toContain("network down");
    });

    it("should stringify object rejections and fall back for strings", async () => {
      fetchMock.mockRejectedValueOnce({ code: "ECONNRESET" });
      const first = await provider.polymarketOdds({});
      expect(first).toContain("ECONNRESET");

      fetchMock.mockRejectedValueOnce("plain string failure");
      const second = await provider.polymarketOdds({});
      expect(second).toContain("plain string failure");
    });
  });

  describe("polymarketDisagreement", () => {
    it("should call the disagreement endpoint with no params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ disagreements: [] }),
      });

      const result = await provider.polymarketDisagreement({});

      expect(fetchMock).toHaveBeenCalledWith("https://api.curade.xyz/v1/polymarket/disagreement");
      expect(result).toContain("disagreements");
    });

    it("should surface the x402 challenge on HTTP 402", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => '{"accepts":[{"scheme":"exact"}]}',
      });

      const result = await provider.polymarketDisagreement({});

      expect(result).toContain("Payment required (HTTP 402)");
      expect(result).toContain("accepts");
    });
  });

  describe("polymarketPackage", () => {
    it("should pass the market param and return the body", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ license: "tok" }),
      });

      const result = await provider.polymarketPackage({ market: "fed-rates" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.curade.xyz/v1/polymarket/package?market=fed-rates",
      );
      expect(result).toContain("license");
    });

    it("should surface the x402 challenge on HTTP 402", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => "challenge",
      });

      const result = await provider.polymarketPackage({ market: "x" });

      expect(result).toContain("Payment required (HTTP 402)");
    });
  });

  describe("hyperliquidFunding", () => {
    it("should call funding/current with the limit param", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ coin: "BTC", funding_rate: "0.0001" }]),
      });

      const result = await provider.hyperliquidFunding({ limit: 10 });

      expect(fetchMock).toHaveBeenCalledWith("https://api.curade.xyz/v1/funding/current?limit=10");
      expect(result).toContain("BTC");
    });

    it("should omit the query string when no params are given", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "[]",
      });

      await provider.hyperliquidFunding({});

      expect(fetchMock).toHaveBeenCalledWith("https://api.curade.xyz/v1/funding/current");
    });

    it("should surface the x402 challenge on HTTP 402", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => "challenge",
      });

      const result = await provider.hyperliquidFunding({ limit: 1 });

      expect(result).toContain("Payment required (HTTP 402)");
    });
  });
});
