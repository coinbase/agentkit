import { agenttollActionProvider } from "./agenttollActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

// The x402 payment wrapper is exercised by its own package tests; here it is
// mocked so these tests cover the provider's request building and error paths.
jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => ({})),
  wrapFetchWithPayment: jest.fn((fetchFn: typeof fetch) => fetchFn),
}));
jest.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: jest.fn(),
}));

describe("AgenttollActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const mockWallet = {
    toSigner: jest.fn().mockReturnValue({ address: "0x1234" }),
    readContract: jest.fn(),
  } as unknown as EvmWalletProvider;
  Object.setPrototypeOf(mockWallet, EvmWalletProvider.prototype);

  const provider = agenttollActionProvider();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("scoutNewTokens", () => {
    it("returns the response body on success", async () => {
      const body = JSON.stringify({ pools: [], summary: { found: 0 } });
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(body) });

      const result = await provider.scoutNewTokens(mockWallet, { minLiquidity: 25000, pools: 2 });

      expect(result).toBe(body);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://agenttoll.app/api/base/scout?minLiquidity=25000&pools=2",
        { method: "GET" },
      );
    });

    it("omits unset query parameters", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });

      await provider.scoutNewTokens(mockWallet, {});

      expect(fetchMock).toHaveBeenCalledWith("https://agenttoll.app/api/base/scout", {
        method: "GET",
      });
    });

    it("reports a non-ok response without throwing", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        text: jest.fn().mockResolvedValue('{"error":"upstream"}'),
      });

      const result = JSON.parse(await provider.scoutNewTokens(mockWallet, {}));

      expect(result.error).toBe(true);
      expect(result.status).toBe(502);
    });

    it("reports network errors without throwing", async () => {
      fetchMock.mockRejectedValue(new Error("boom"));

      const result = JSON.parse(await provider.scoutNewTokens(mockWallet, {}));

      expect(result.error).toBe(true);
      expect(result.message).toContain("boom");
    });
  });

  describe("checkTokenSafety", () => {
    it("builds the path from the address", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });
      const address = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";

      await provider.checkTokenSafety(mockWallet, { address });

      expect(fetchMock).toHaveBeenCalledWith(`https://agenttoll.app/api/base/safety/${address}`, {
        method: "GET",
      });
    });
  });

  describe("getWalletPortfolio", () => {
    it("passes the optional floor and limit", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });
      const address = "0xe55359021A6A22D8385b827405991c56075F56f8";

      await provider.getWalletPortfolio(mockWallet, { address, minValue: 100, limit: 5 });

      expect(fetchMock).toHaveBeenCalledWith(
        `https://agenttoll.app/api/base/portfolio/${address}?minValue=100&limit=5`,
        { method: "GET" },
      );
    });
  });

  describe("resolveBasename", () => {
    it("URL-encodes the query", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });

      await provider.resolveBasename(mockWallet, { query: "jesse.base.eth" });

      expect(fetchMock).toHaveBeenCalledWith("https://agenttoll.app/api/base/name/jesse.base.eth", {
        method: "GET",
      });
    });
  });

  describe("getMarketBrief", () => {
    it("joins symbols into one parameter", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });

      await provider.getMarketBrief(mockWallet, { symbols: ["eth", "degen"] });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://agenttoll.app/api/brief?symbols=eth%2Cdegen",
        {
          method: "GET",
        },
      );
    });
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet only", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });
  });

  describe("config", () => {
    it("honors a base URL override", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });
      const custom = agenttollActionProvider({ baseUrl: "https://example.test/" });

      await custom.getMarketBrief(mockWallet, {});

      expect(fetchMock).toHaveBeenCalledWith("https://example.test/api/brief", { method: "GET" });
    });
  });
});
