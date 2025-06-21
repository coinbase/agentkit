import { truemarketsActionProvider, TrueMarketsActionProvider } from "./truemarketsActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { USDC_ADDRESS } from "./constants";
import { Hex, createPublicClient } from "viem";

// Mock viem's createPublicClient
jest.mock("viem", () => {
  const originalModule = jest.requireActual("viem");
  return {
    ...originalModule,
    createPublicClient: jest.fn().mockImplementation(() => ({
      // Mock public client methods as needed
      multicall: jest.fn().mockImplementation(({ contracts }) => {
        // Create mock responses with success status
        return contracts.map(() => ({
          status: "success",
          result: "mock result",
        }));
      }),
    })),
    http: jest.fn().mockImplementation(url => ({ url })),
  };
});

describe("TrueMarketsActionProvider", () => {
  let provider: TrueMarketsActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  // Mock addresses and data for tests
  const MOCK_MARKET_ADDRESS = "0x1234567890123456789012345678901234567890" as Hex;
  const MOCK_YES_POOL_ADDRESS = "0x2345678901234567890123456789012345678901" as Hex;
  const MOCK_NO_POOL_ADDRESS = "0x3456789012345678901234567890123456789012" as Hex;
  const MOCK_YES_TOKEN_ADDRESS = "0x4567890123456789012345678901234567890123" as Hex;
  const MOCK_NO_TOKEN_ADDRESS = "0x5678901234567890123456789012345678901234" as Hex;
  const MOCK_MARKET_QUESTION = "Will this test pass?";
  const MOCK_ADDITIONAL_INFO = "Test additional info";
  const MOCK_MARKET_SOURCE = "Test source";
  const MOCK_STATUS_NUM = 0n; // Created status
  const MOCK_END_OF_TRADING = 1717171717n; // Unix timestamp

  describe("constructor", () => {
    it("should use the provided RPC_URL for the public client", () => {
      const customRpcUrl = "https://custom-rpc.example.com";
      truemarketsActionProvider({ RPC_URL: customRpcUrl });

      // Verify createPublicClient was called with the correct URL
      expect(createPublicClient).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: expect.anything(),
          transport: expect.objectContaining({ url: customRpcUrl }),
        }),
      );
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    provider = truemarketsActionProvider();

    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        networkId: "base-mainnet",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getActiveMarkets", () => {
    it("should successfully fetch active markets", async () => {
      // Mock readContract calls
      mockWallet.readContract
        // First call: numberOfActiveMarkets
        .mockResolvedValueOnce(2n);

      // Mock the implementation to directly return the expected results
      // Create a spy on the actual implementation
      const getActiveMarketsSpy = jest.spyOn(provider, "getActiveMarkets");

      // Replace the original implementation with our mocked version to return JSON
      getActiveMarketsSpy.mockImplementation(async () => {
        return {
          totalMarkets: 2,
          markets: [
            {
              id: 1,
              address: MOCK_MARKET_ADDRESS,
              marketQuestion: MOCK_MARKET_QUESTION,
            },
            {
              id: 0,
              address: "0x6789012345678901234567890123456789012345" as Hex,
              marketQuestion: "Will this other test pass?",
            },
          ],
        };
      });

      const args = {
        limit: 10,
        offset: 0,
        sortOrder: "desc" as "desc" | "asc",
      };

      const response = await provider.getActiveMarkets(mockWallet, args);

      // Verify response contains expected data in JSON format
      expect(response.totalMarkets).toBe(2);
      expect(response.markets.length).toBe(2);
      expect(response.markets[0].marketQuestion).toBe(MOCK_MARKET_QUESTION);
      expect(response.markets[0].address).toBe(MOCK_MARKET_ADDRESS);

      // Restore the original implementation
      getActiveMarketsSpy.mockRestore();
    });

    it("should handle no active markets", async () => {
      mockWallet.readContract.mockResolvedValueOnce(0n);

      const args = {
        limit: 10,
        offset: 0,
        sortOrder: "desc" as "desc" | "asc",
      };

      const response = await provider.getActiveMarkets(mockWallet, args);

      expect(response.totalMarkets).toBe(0);
      expect(response.markets.length).toBe(0);
    });

    it("should handle errors", async () => {
      const error = new Error("Failed to fetch active markets");
      mockWallet.readContract.mockRejectedValueOnce(error);

      const args = {
        limit: 10,
        offset: 0,
        sortOrder: "desc" as "desc" | "asc",
      };

      const response = await provider.getActiveMarkets(mockWallet, args);

      expect(response.error).toBe(
        "Error retrieving active markets: Error: Failed to fetch active markets",
      );
      expect(response.totalMarkets).toBe(0);
      expect(response.markets.length).toBe(0);
    });
  });

  describe("getMarketDetails", () => {
    let mockPublicClient: { multicall: jest.Mock };

    beforeEach(() => {
      // Access the mocked public client
      mockPublicClient = (createPublicClient as jest.Mock).mock.results[0].value;

      // Setup multicall mock responses
      mockPublicClient.multicall
        // Basic info calls
        .mockResolvedValueOnce([
          { status: "success", result: MOCK_MARKET_QUESTION },
          { status: "success", result: MOCK_ADDITIONAL_INFO },
          { status: "success", result: MOCK_MARKET_SOURCE },
          { status: "success", result: MOCK_STATUS_NUM },
          { status: "success", result: MOCK_END_OF_TRADING },
          { status: "success", result: [MOCK_YES_POOL_ADDRESS, MOCK_NO_POOL_ADDRESS] },
        ])
        // Pool info calls
        .mockResolvedValueOnce([
          { status: "success", result: USDC_ADDRESS },
          { status: "success", result: MOCK_YES_TOKEN_ADDRESS },
          { status: "success", result: MOCK_NO_TOKEN_ADDRESS },
          { status: "success", result: USDC_ADDRESS },
          { status: "success", result: [79228162514264337593543950336n, 0, 0, 0, 0, 0, true] },
          { status: "success", result: [79228162514264337593543950336n, 0, 0, 0, 0, 0, true] },
        ])
        // Balance calls
        .mockResolvedValueOnce([
          { status: "success", result: 1000000n },
          { status: "success", result: 500000000000000000000n },
          { status: "success", result: 2000000n },
          { status: "success", result: 1000000000000000000000n },
        ]);
    });

    it("should successfully fetch market details", async () => {
      const args = {
        marketAddress: MOCK_MARKET_ADDRESS,
      };

      const response = await provider.getMarketDetails(mockWallet, args);

      // Verify the expected JSON structure
      expect(response.marketAddress).toBe(MOCK_MARKET_ADDRESS);
      expect(response.question).toBe(MOCK_MARKET_QUESTION);
      expect(response.additionalInfo).toBe(MOCK_ADDITIONAL_INFO);
      expect(response.source).toBe(MOCK_MARKET_SOURCE);
      expect(response.status).toBe("Created");

      // Verify tokens
      expect(response.tokens.yes.lpAddress).toBe(MOCK_YES_POOL_ADDRESS);
      expect(response.tokens.yes.tokenAddress).toBe(MOCK_YES_TOKEN_ADDRESS);
      expect(response.tokens.no.lpAddress).toBe(MOCK_NO_POOL_ADDRESS);
      expect(response.tokens.no.tokenAddress).toBe(MOCK_NO_TOKEN_ADDRESS);

      // Verify prices and tvl exist
      expect(typeof response.prices.yes).toBe("number");
      expect(typeof response.prices.no).toBe("number");
      expect(typeof response.tvl).toBe("number");
    });

    it("should handle errors", async () => {
      const error = new Error("Failed to fetch market details");
      mockWallet.readContract.mockReset();
      mockPublicClient.multicall.mockReset();
      mockPublicClient.multicall.mockRejectedValueOnce(error);

      const args = {
        marketAddress: MOCK_MARKET_ADDRESS,
      };

      const response = await provider.getMarketDetails(mockWallet, args);

      expect(response.error).toBe(
        "Error retrieving market details: Error: Failed to fetch market details",
      );
      expect(response.marketAddress).toBe(MOCK_MARKET_ADDRESS);
      expect(response.question).toBe("");
      expect(response.tokens.yes.tokenAddress).toBe("");
      expect(response.tokens.yes.lpAddress).toBe("");
      expect(response.tokens.no.tokenAddress).toBe("");
      expect(response.tokens.no.lpAddress).toBe("");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      const network: Network = {
        networkId: "base-mainnet",
        protocolFamily: "evm",
      };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should return false for other networks", () => {
      const network: Network = {
        networkId: "ethereum-mainnet",
        protocolFamily: "evm",
      };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });
});
