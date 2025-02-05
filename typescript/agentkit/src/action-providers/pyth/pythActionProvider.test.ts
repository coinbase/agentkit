import { pythActionProvider } from "./pythActionProvider";

describe("PythActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = pythActionProvider();

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
  });

  describe("fetchPriceFeed", () => {
    it("should return the first price feed ID that matches the input token symbol", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "some-price-feed-id", attributes: { base: "BTC" } }],
      });

      const priceFeedId = await provider.fetchPriceFeed({ tokenSymbol: "BTC" });
      expect(priceFeedId).toEqual("some-price-feed-id");
    });

    it("should throw an error if no price feed is found", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "some-price-feed-id", attributes: { base: "BTC" } }],
      });

      await expect(provider.fetchPriceFeed({ tokenSymbol: "ETH" })).rejects.toThrow(
        "No price feed found for ETH",
      );
    });

    it("should throw an error if the response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(provider.fetchPriceFeed({ tokenSymbol: "BTC" })).rejects.toThrow(
        "HTTP error! status: 404",
      );
    });

    it("should throw an error if response is ok but no data is returned", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = pythActionProvider();

      await expect(provider.fetchPriceFeed({ tokenSymbol: "BTC" })).rejects.toThrow(
        "No price feed found for BTC",
      );
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

      const price = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });

      expect(price).toEqual("1");
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

      const provider = pythActionProvider();

      const price = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });

      expect(price).toEqual("1.00");
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

      const price = await provider.fetchPrice({ priceFeedID: "some-price-feed-id" });

      expect(price).toEqual("0.25");
    });

    it("should throw an error if there is no price data", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [],
        }),
      });

      await expect(provider.fetchPrice({ priceFeedID: "some-price-feed-id" })).rejects.toThrow(
        "No price data found for some-price-feed-id",
      );
    });

    it("should throw an error if response is not ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(provider.fetchPrice({ priceFeedID: "some-price-feed-id" })).rejects.toThrow(
        "HTTP error! status: 404",
      );
    });
  });
});
