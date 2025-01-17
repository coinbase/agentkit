import {
  PythFetchPriceFeedIDInput,
  pythFetchPriceFeedID,
} from "../actions/cdp/data/pyth/fetch_price_feed_id";

const MOCK_TOKEN_SYMBOL = "BTC";

describe("Pyth Fetch Price Feed ID Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      tokenSymbol: MOCK_TOKEN_SYMBOL,
    };

    const result = PythFetchPriceFeedIDInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = PythFetchPriceFeedIDInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Pyth Fetch Price Feed ID Action", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("successfully fetches price feed ID for a token", async () => {
    const mockResponse = [
      {
        id: "0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a",
        type: "price_feed",
        attributes: {
          base: "BTC",
          quote: "USD",
          asset_type: "crypto",
        },
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await pythFetchPriceFeedID({ tokenSymbol: MOCK_TOKEN_SYMBOL });

    // Verify the result
    expect(result).toBe("0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a");

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith(
      "https://hermes.pyth.network/v2/price_feeds?query=BTC&asset_type=crypto",
    );
  });

  it("throws error when HTTP request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(pythFetchPriceFeedID({ tokenSymbol: MOCK_TOKEN_SYMBOL })).rejects.toThrow(
      "HTTP error! status: 404",
    );
  });

  it("throws error when no data is returned", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await expect(pythFetchPriceFeedID({ tokenSymbol: "INVALID" })).rejects.toThrow(
      "No price feed found for INVALID",
    );
  });
});
