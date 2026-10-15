import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { marketIntelligenceActionProvider } from "./marketIntelligenceActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockPaidFetch = jest.fn();
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockPaidFetch);

const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Builds a fetch Response-like object.
 *
 * @param status - HTTP status.
 * @param body - JSON body.
 * @param headers - Response headers.
 * @returns The mocked response.
 */
function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

describe("MarketIntelligenceActionProvider", () => {
  const wallet = {
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
    toSigner: jest.fn().mockReturnValue({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(wrapFetchWithPayment).mockReturnValue(mockPaidFetch);
    delete process.env.MARKET_INTELLIGENCE_API_KEY;
  });

  describe("supportsNetwork", () => {
    it("supports EVM networks only", () => {
      const provider = marketIntelligenceActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });

  describe("paid calls", () => {
    it("pays with x402 from the wallet and returns data and transaction", async () => {
      const settlement = Buffer.from(JSON.stringify({ transaction: "0xabc" })).toString("base64");
      mockPaidFetch.mockResolvedValue(
        response(200, { action: "BUY" }, { "payment-response": settlement }),
      );
      const provider = marketIntelligenceActionProvider();

      const result = JSON.parse(
        await provider.getTradingDecision(wallet, { symbol: "ETHUSD", side: "buy" }),
      );

      expect(registerExactEvmScheme).toHaveBeenCalledWith(expect.any(x402Client), {
        signer: wallet.toSigner(),
      });
      expect(mockPaidFetch).toHaveBeenCalledWith(
        "https://api.marketintelligenceapi.com/api/v1/decision/lite/ETHUSD?side=buy",
        { headers: { Accept: "application/json" } },
      );
      expect(result).toEqual({ data: { action: "BUY" }, transaction: "0xabc" });
    });

    it("reuses the paying fetch for the same wallet", async () => {
      mockPaidFetch.mockResolvedValue(response(200, {}));
      const provider = marketIntelligenceActionProvider();

      await provider.getMarketRegime(wallet, { window: null });
      await provider.getMacroCalendar(wallet, { days: 7, importance: null });

      expect(wrapFetchWithPayment).toHaveBeenCalledTimes(1);
      expect(mockPaidFetch).toHaveBeenNthCalledWith(
        1,
        "https://api.marketintelligenceapi.com/api/v1/intelligence/regime",
        expect.anything(),
      );
      expect(mockPaidFetch).toHaveBeenNthCalledWith(
        2,
        "https://api.marketintelligenceapi.com/api/v1/calendar?days=7",
        expect.anything(),
      );
    });

    it("uses the API key instead of the wallet when configured", async () => {
      mockFetch.mockResolvedValue(response(200, { verdict: "LOW_RISK" }));
      const provider = marketIntelligenceActionProvider({ apiKey: "mi_test" });

      await provider.checkTokenRisk(wallet, { address: "0x" + "1".repeat(40), chain: "base" });

      expect(mockPaidFetch).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.marketintelligenceapi.com/api/v1/intelligence/token-risk/0x${"1".repeat(40)}?chain=base`,
        { headers: { Accept: "application/json", "X-API-Key": "mi_test" } },
      );
    });

    it("refuses calls above maxPriceUsd without calling the API", async () => {
      const provider = marketIntelligenceActionProvider({ maxPriceUsd: 0.01 });

      const result = JSON.parse(
        await provider.getTradingDecision(wallet, { symbol: "BTCUSD", side: null }),
      );

      expect(result.error).toBe(true);
      expect(result.message).toContain("above the configured maxPriceUsd");
      expect(mockPaidFetch).not.toHaveBeenCalled();
    });

    it("returns HTTP errors with their status", async () => {
      mockPaidFetch.mockResolvedValue(response(404, { error: "unknown symbol" }));
      const provider = marketIntelligenceActionProvider();

      const result = JSON.parse(await provider.explainPriceMove(wallet, { symbol: "NOPE" }));

      expect(result).toEqual({ error: true, status: 404, data: { error: "unknown symbol" } });
    });

    it("returns network errors as messages", async () => {
      mockPaidFetch.mockRejectedValue(new Error("network down"));
      const provider = marketIntelligenceActionProvider();

      const result = JSON.parse(
        await provider.getInsiderTrades(wallet, { symbol: "TSLA", days: 30 }),
      );

      expect(result).toEqual({ error: true, message: "network down" });
    });
  });

  describe("paths", () => {
    beforeEach(() => mockPaidFetch.mockResolvedValue(response(200, {})));

    it("builds the new-tokens, quote, futures and fundamentals routes", async () => {
      const provider = marketIntelligenceActionProvider();

      await provider.findNewTokens(wallet, {
        chain: "base",
        minutes: 30,
        verdict: "LOW_RISK",
        minLiquidityUsd: null,
      });
      await provider.getSwapQuote(wallet, {
        chain: "base",
        sell: "USDC",
        buy: "WETH",
        amount: "100",
      });
      await provider.getFuturesPositioning(wallet, { market: "gold" });
      await provider.getFuturesPositioning(wallet, { market: null });
      await provider.getStockFundamentals(wallet, { symbols: ["AAPL", "MSFT"] });

      const urls = mockPaidFetch.mock.calls.map(call => call[0]);
      expect(urls).toEqual([
        "https://api.marketintelligenceapi.com/api/v1/intelligence/new-tokens?chain=base&minutes=30&verdict=LOW_RISK",
        "https://api.marketintelligenceapi.com/api/v1/intelligence/quote?chain=base&sell=USDC&buy=WETH&amount=100",
        "https://api.marketintelligenceapi.com/api/v1/cot/gold",
        "https://api.marketintelligenceapi.com/api/v1/cot",
        "https://api.marketintelligenceapi.com/api/v1/fundamentals/batch?symbols=AAPL%2CMSFT",
      ]);
    });

    it("calls the free track record without paying", async () => {
      mockFetch.mockResolvedValue(response(200, { hitRate: 0.55 }));
      const provider = marketIntelligenceActionProvider();

      await provider.getDecisionTrackRecord(wallet, { days: null });

      expect(mockPaidFetch).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.marketintelligenceapi.com/api/v1/decision/track-record",
        expect.anything(),
      );
    });
  });
});
