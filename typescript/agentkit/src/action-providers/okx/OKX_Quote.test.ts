import { okxDexActionProvider, OKXDexActionProvider } from "./OKXDexActionProvider";
import { Network } from "../../network";
import { OKXDexClient } from "@okx-dex/okx-dex-sdk";

// Mock the OKX DEX SDK
jest.mock("@okx-dex/okx-dex-sdk", () => ({
  OKXDexClient: jest.fn().mockImplementation(() => ({
    dex: {
      getQuote: jest.fn().mockImplementation(() => Promise.resolve({}))
    }
  }))
}));

describe("OKXDexActionProvider", () => {
  let provider: OKXDexActionProvider;
  let mockDexClient: { dex: { getQuote: jest.Mock } };

  // Test data
  const MOCK_CONFIG = {
    apiKey: "test-api-key",
    secretKey: "test-secret-key",
    apiPassphrase: "test-passphrase",
    projectId: "test-project-id"
  };

  const MOCK_QUOTE_RESPONSE = {
    quoteId: "mock-quote-id-123456",
    price: "0.067891234567890123",
    guaranteedPrice: "0.067212322098765432",
    estimatedGas: "150000",
    validTo: 1678901234,
    route: [
      {
        dex: "OKX",
        percent: 100,
        path: ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", "0xdAC17F958D2ee523a2206206994597C13D831ec7"]
      }
    ],
    fromTokenAmount: "10000000000000000000",
    toTokenAmount: "678912345678901230",
    priceImpact: "0.05"
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OKX_API_KEY = MOCK_CONFIG.apiKey;
    process.env.OKX_SECRET_KEY = MOCK_CONFIG.secretKey;
    process.env.OKX_API_PASSPHRASE = MOCK_CONFIG.apiPassphrase;
    process.env.OKX_PROJECT_ID = MOCK_CONFIG.projectId;
    
    // Initialize provider
    provider = okxDexActionProvider();
    
    // Get mock client instance
    mockDexClient = (OKXDexClient as jest.Mock).mock.results[0].value;
  });

  describe("initialization", () => {
    it("should initialize with environment variables", () => {
      expect(() => okxDexActionProvider()).not.toThrow();
    });

    it("should throw error if missing required config", () => {
      process.env.OKX_API_KEY = "";
      expect(() => okxDexActionProvider()).toThrow();
    });
  });

  describe("getSwapQuote", () => {
    const quoteArgs = {
      chainId: "1",
      fromTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH
      toTokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      amount: "10000000000000000000", // 10 ETH
      slippage: "0.1"
    };

    it("should successfully fetch a swap quote", async () => {
      // Setup mock response
      mockDexClient.dex.getQuote.mockResolvedValue(MOCK_QUOTE_RESPONSE);

      const response = await provider.getSwapQuote(quoteArgs);
      
      // Verify correct parameters were passed
      expect(mockDexClient.dex.getQuote).toHaveBeenCalledWith(expect.objectContaining({
        chainId: quoteArgs.chainId,
        fromTokenAddress: quoteArgs.fromTokenAddress,
        toTokenAddress: quoteArgs.toTokenAddress,
        amount: quoteArgs.amount,
        slippage: quoteArgs.slippage
      }));
      
      // Verify response format
      expect(response).toContain("Successfully fetched OKX DEX swap quote");
      expect(response).toContain(JSON.stringify(MOCK_QUOTE_RESPONSE, null, 2));
    });

    it("should handle API errors gracefully", async () => {
      // Setup mock error
      const mockError = new Error("API error");
      mockDexClient.dex.getQuote.mockRejectedValue(mockError);
      
      const response = await provider.getSwapQuote(quoteArgs);
      expect(response).toBe(`Error fetching OKX DEX swap quote: ${mockError}`);
    });

    it("should handle network errors", async () => {
      // Setup network error
      mockDexClient.dex.getQuote.mockRejectedValue(new Error("Network error"));
      
      const response = await provider.getSwapQuote(quoteArgs);
      expect(response).toContain("Error fetching OKX DEX swap quote");
    });
  });

  describe("supportsNetwork", () => {
    test.each([
      [{ protocolFamily: "evm", chainId: "1" }, true, "Ethereum mainnet"],
      [{ protocolFamily: "evm", chainId: "56" }, true, "BSC"],
      [{ protocolFamily: "evm", chainId: "137" }, true, "Polygon"],
      [{ protocolFamily: "evm", chainId: "999" }, false, "Unsupported chain"],
      [{ protocolFamily: "evm" }, true, "No chainId provided"],
    ])("should return %p for %s", (network: Network, expected: boolean, _testCase: string) => {
      expect(provider.supportsNetwork(network)).toBe(expected);
    });
  });
});