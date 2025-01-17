import { PythFetchPriceInput, pythFetchPrice } from "../actions/cdp/data/pyth/fetch_price";

const MOCK_PRICE_FEED_ID = "valid-price-feed-id";

describe("Pyth Fetch Price Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      priceFeedID: MOCK_PRICE_FEED_ID,
    };

    const result = PythFetchPriceInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = PythFetchPriceInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Pyth Fetch Price Action", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("successfully fetches and formats price with decimal places", async () => {
    const mockResponse = {
      parsed: [
        {
          price: {
            price: "4212345",
            expo: -2,
            conf: "1234",
          },
          id: MOCK_PRICE_FEED_ID,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await pythFetchPrice({ priceFeedID: MOCK_PRICE_FEED_ID });

    expect(result).toBe("42123.45");

    expect(global.fetch).toHaveBeenCalledWith(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${MOCK_PRICE_FEED_ID}`,
    );
  });

  it("throws error when HTTP request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(pythFetchPrice({ priceFeedID: MOCK_PRICE_FEED_ID })).rejects.toThrow(
      "HTTP error! status: 404",
    );
  });

  it("throws error when no parsed data is available", async () => {
    const mockResponse = {
      parsed: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(pythFetchPrice({ priceFeedID: MOCK_PRICE_FEED_ID })).rejects.toThrow(
      `No price data found for ${MOCK_PRICE_FEED_ID}`,
    );
  });
});
