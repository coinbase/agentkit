import {
  alchemyTokenPricesActionProvider,
  AlchemyTokenPricesActionProvider,
} from "./alchemyTokenPricesActionProvider";

const MOCK_API_KEY = "alch-demo";

// Sample responses for each action
const MOCK_TOKEN_PRICES_BY_SYMBOL_RESPONSE = {
  data: [
    {
      symbol: "ETH",
      prices: [
        {
          currency: "usd",
          value: "2873.490923459",
          lastUpdatedAt: "2025-02-03T23:46:40Z",
        },
      ],
    },
  ],
};

const MOCK_TOKEN_PRICES_BY_ADDRESS_RESPONSE = {
  data: [
    {
      network: "eth-mainnet",
      address: "0x1234567890abcdef",
      prices: [
        {
          currency: "usd",
          value: "1234.56",
          lastUpdatedAt: "2025-02-03T23:46:40Z",
        },
      ],
    },
  ],
};

describe("AlchemyTokenPricesActionProvider", () => {
  let provider: AlchemyTokenPricesActionProvider;

  beforeEach(() => {
    process.env.ALCHEMY_API_KEY = MOCK_API_KEY;
    provider = alchemyTokenPricesActionProvider({ apiKey: MOCK_API_KEY });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("tokenPricesBySymbol", () => {
    it("should successfully fetch token prices by symbol", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_TOKEN_PRICES_BY_SYMBOL_RESPONSE,
      } as Response);

      const response = await provider.tokenPricesBySymbol({ symbols: ["ETH", "BTC"] });

      // Verify the URL has the correct API key and query parameters.
      const expectedUrlPart = `${provider["baseUrl"]}/${MOCK_API_KEY}/tokens/by-symbol`;
      expect(fetchMock).toHaveBeenCalled();
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain(expectedUrlPart);
      expect(calledUrl).toContain("symbols=ETH");
      expect(calledUrl).toContain("symbols=BTC");

      expect(response).toContain("Successfully fetched token prices by symbol");
      expect(response).toContain(JSON.stringify(MOCK_TOKEN_PRICES_BY_SYMBOL_RESPONSE, null, 2));
    });

    it("should handle non-ok response for token prices by symbol", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);

      const response = await provider.tokenPricesBySymbol({ symbols: ["ETH"] });
      expect(response).toContain("Error fetching token prices by symbol");
      expect(response).toContain("400");
    });

    it("should handle fetch error for token prices by symbol", async () => {
      const error = new Error("Fetch error");
      jest.spyOn(global, "fetch").mockRejectedValue(error);

      const response = await provider.tokenPricesBySymbol({ symbols: ["ETH"] });
      expect(response).toContain("Error fetching token prices by symbol");
      expect(response).toContain(error.message);
    });
  });

  describe("tokenPricesByAddress", () => {
    it("should successfully fetch token prices by address", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_TOKEN_PRICES_BY_ADDRESS_RESPONSE,
      } as Response);

      const payload = {
        addresses: [{ network: "eth-mainnet", address: "0x1234567890abcdef" }],
      };

      const response = await provider.tokenPricesByAddress(payload);
      expect(fetchMock).toHaveBeenCalled();

      // Verify that fetch was called with the correct POST URL and options.
      const expectedUrl = `${provider["baseUrl"]}/${MOCK_API_KEY}/tokens/by-address`;
      expect(fetchMock).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Accept: "application/json",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(payload),
        }),
      );

      expect(response).toContain("Successfully fetched token prices by address");
      expect(response).toContain(JSON.stringify(MOCK_TOKEN_PRICES_BY_ADDRESS_RESPONSE, null, 2));
    });

    it("should handle non-ok response for token prices by address", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
      } as Response);

      const payload = {
        addresses: [{ network: "eth-mainnet", address: "0x1234567890abcdef" }],
      };

      const response = await provider.tokenPricesByAddress(payload);
      expect(response).toContain("Error fetching token prices by address");
      expect(response).toContain("429");
    });

    it("should handle fetch error for token prices by address", async () => {
      const error = new Error("Fetch error");
      jest.spyOn(global, "fetch").mockRejectedValue(error);

      const payload = {
        addresses: [{ network: "eth-mainnet", address: "0x1234567890abcdef" }],
      };

      const response = await provider.tokenPricesByAddress(payload);
      expect(response).toContain("Error fetching token prices by address");
      expect(response).toContain(error.message);
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
