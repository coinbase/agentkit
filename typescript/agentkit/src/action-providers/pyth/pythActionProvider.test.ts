import { pythActionProvider } from "./pythActionProvider";

describe("PythActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = pythActionProvider();

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("fetchPriceFeed", () => {
    it("should return the first price feed ID that matches the input token symbol for crypto", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "some-price-feed-id", attributes: { base: "BTC", quote_currency: "USD" } },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "BTC",
        assetType: "crypto",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("some-price-feed-id");
    });

    it("should return the first price feed ID that matches the input token symbol for metals", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "gold-price-feed-id", attributes: { base: "XAU", quote_currency: "USD" } },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "XAU",
        assetType: "metal",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("gold-price-feed-id");
    });

    it("should return the first price feed ID that matches the input token symbol for commodities", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "oil-price-feed-id", attributes: { base: "WTI", quote_currency: "USD" } },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "WTI",
        assetType: "metal",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("oil-price-feed-id");
    });

    it("should return the first price feed ID that matches the input token symbol for equities", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "apple-price-feed-id",
            attributes: {
              base: "AAPL",
              quote_currency: "USD",
              symbol: "Equity.US.AAPL/USD",
              display_symbol: "AAPL/USD",
            },
          },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "AAPL",
        assetType: "equity",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("apple-price-feed-id");
    });

    it("should return the first price feed ID that matches the input token symbol for FX", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "eur-price-feed-id", attributes: { base: "EUR", quote_currency: "USD" } },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "EUR",
        assetType: "fx",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("eur-price-feed-id");
    });

    it("should return error if no price feed is found", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "some-price-feed-id", attributes: { base: "BTC", quote_currency: "USD" } },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "SOL",
        assetType: "crypto",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No price feed found for SOL/USD");
    });

    it("should return error if the response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "BTC",
        assetType: "crypto",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP error! status: 404");
    });

    it("should return error if response is ok but no data is returned", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "BTC",
        assetType: "crypto",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No price feed found for BTC");
    });

    it("should prefer regular market hours feed for equities over pre/post market", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "post-market-feed-id",
            attributes: {
              base: "COIN",
              quote_currency: "USD",
              symbol: "Equity.US.COIN/USD.POST",
              display_symbol: "COIN/USD POST MARKET",
            },
          },
          {
            id: "regular-market-feed-id",
            attributes: {
              base: "COIN",
              quote_currency: "USD",
              symbol: "Equity.US.COIN/USD",
              display_symbol: "COIN/USD",
            },
          },
          {
            id: "pre-market-feed-id",
            attributes: {
              base: "COIN",
              quote_currency: "USD",
              symbol: "Equity.US.COIN/USD.PRE",
              display_symbol: "COIN/USD PRE MARKET",
            },
          },
        ],
      });

      const result = await provider.fetchPriceFeed({
        tokenSymbol: "COIN",
        assetType: "equity",
        quoteCurrency: "USD",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceFeedID).toEqual("regular-market-feed-id");
      expect(parsed.feedType).toEqual("COIN/USD");
    });
  });

  describe("fetchPrice", () => {
    it("should return the price for a given price feed ID", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [
            {
              price: {
                price: 100,
                expo: 2,
              },
            },
          ],
        }),
      });

      const result = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.price).toEqual("1");
    });

    it("should return the price for a given price feed ID with a negative exponent", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [
            {
              price: {
                price: 100,
                expo: -2,
              },
            },
          ],
        }),
      });

      const result = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.price).toEqual("1.00");
    });

    it("should handle scaled price starting with a decimal", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [
            {
              price: {
                price: 25,
                expo: -2,
              },
            },
          ],
        }),
      });

      const result = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.price).toEqual("0.25");
    });

    it("should return error if there is no price data", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [],
        }),
      });

      const result = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No price data found for some-price-feed-id");
    });

    it("should return error if response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP error! status: 404");
    });
  });
});
