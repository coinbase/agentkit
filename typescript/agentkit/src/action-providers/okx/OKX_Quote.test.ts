import { okxDexActionProvider, OKXDexActionProvider } from "./OKXDexActionProvider";
import { Network } from "../../network";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("OKXDexActionProvider", () => {
  let provider: OKXDexActionProvider;

  // Test data
  const MOCK_CONFIG = {
    apiKey: "test-api-key",
    secretKey: "test-secret-key",
    apiPassphrase: "test-passphrase",
    projectId: "test-project-id"
  };

  const MOCK_QUOTE_RESPONSE = {
    code: "0",
    data: [{
      routerResult: {
        chainId: "1",
        fromTokenAmount: "10000000000000000000",
        toTokenAmount: "678912345678901230",
        tradeFee: "0",
        estimateGasFee: "150000",
        dexRouterList: [{
          router: "0x123",
          routerPercent: "100",
          subRouterList: [{
            dexProtocol: [{
              dexName: "OKX",
              percent: "100"
            }],
            fromToken: {
              tokenSymbol: "ETH",
              decimal: "18",
              tokenUnitPrice: "2000"
            },
            toToken: {
              tokenSymbol: "USDT",
              decimal: "6",
              tokenUnitPrice: "1"
            }
          }]
        }],
        fromToken: {
          tokenSymbol: "ETH",
          decimal: "18",
          tokenUnitPrice: "2000"
        },
        toToken: {
          tokenSymbol: "USDT",
          decimal: "6",
          tokenUnitPrice: "1"
        },
        priceImpactPercentage: "0.05"
      }
    }],
    msg: "success"
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
      slippage: "0.1",
      dexIds: null,
      directRoute: null,
      priceImpactProtectionPercentage: null,
      autoSlippage: null,
      maxAutoSlippage: null
    };

    it("should successfully fetch a swap quote", async () => {
      // Setup mock response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_QUOTE_RESPONSE)
      });

      const response = await provider.getSwapQuote(quoteArgs);
      
      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v5/dex/aggregator/quote"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "OK-ACCESS-KEY": MOCK_CONFIG.apiKey,
            "OK-ACCESS-PASSPHRASE": MOCK_CONFIG.apiPassphrase,
            "OK-ACCESS-PROJECT": MOCK_CONFIG.projectId
          })
        })
      );
      
      // Verify response format
      expect(response).toContain("Successfully fetched OKX DEX swap quote");
      expect(response).toContain(JSON.stringify(MOCK_QUOTE_RESPONSE, null, 2));
    });

    it("should handle API errors gracefully", async () => {
      // Setup mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "50000", msg: "API error" })
      });
      
      const response = await provider.getSwapQuote(quoteArgs);
      expect(response).toContain("Error fetching OKX DEX swap quote");
      expect(response).toContain("API error");
    });

    it("should handle network errors", async () => {
      // Setup network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      
      const response = await provider.getSwapQuote(quoteArgs);
      expect(response).toContain("Error fetching OKX DEX swap quote");
      expect(response).toContain("Network error");
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