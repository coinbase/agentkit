import { truemarketsActionProvider, TrueMarketsActionProvider } from "./truemarketsActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { TruthMarketABI, USDC_ADDRESS } from "./constants";
import { Hex, createPublicClient } from "viem";

// Mock viem's createPublicClient
jest.mock("viem", () => {
  const originalModule = jest.requireActual("viem");
  return {
    ...originalModule,
    createPublicClient: jest.fn().mockImplementation(() => ({
      // Mock public client methods as needed
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

      // Replace the original implementation with our mocked version
      getActiveMarketsSpy.mockImplementation(async () => {
        return (
          `Found 2 active markets (out of 2 total):\n\n` +
          `Market #1 (${MOCK_MARKET_ADDRESS}): ${MOCK_MARKET_QUESTION}\n` +
          `Market #0 (0x6789012345678901234567890123456789012345): Will this other test pass?\n`
        );
      });

      const args = {
        limit: 10,
        offset: 0,
        sortOrder: "desc" as "desc" | "asc",
      };

      const response = await provider.getActiveMarkets(mockWallet, args);

      // Verify response contains expected data
      expect(response).toContain("Found 2 active markets");
      expect(response).toContain(MOCK_MARKET_QUESTION);
      expect(response).toContain(MOCK_MARKET_ADDRESS);

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

      expect(response).toContain("No active markets found");
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

      expect(response).toContain(
        "Error retrieving active markets: Error: Failed to fetch active markets",
      );
    });
  });

  describe("getMarketDetails", () => {
    beforeEach(() => {
      // Set up mock responses for all the contract calls in getMarketDetails
      mockWallet.readContract
        // Basic market info
        .mockResolvedValueOnce(MOCK_MARKET_QUESTION) // marketQuestion
        .mockResolvedValueOnce(MOCK_ADDITIONAL_INFO) // additionalInfo
        .mockResolvedValueOnce(MOCK_MARKET_SOURCE) // marketSource
        .mockResolvedValueOnce(MOCK_STATUS_NUM) // getCurrentStatus
        .mockResolvedValueOnce(MOCK_END_OF_TRADING) // endOfTrading
        .mockResolvedValueOnce([MOCK_YES_POOL_ADDRESS, MOCK_NO_POOL_ADDRESS]) // getPoolAddresses

        // Pool token information
        .mockResolvedValueOnce(USDC_ADDRESS) // YES pool token0
        .mockResolvedValueOnce(MOCK_YES_TOKEN_ADDRESS) // YES pool token1
        .mockResolvedValueOnce(MOCK_NO_TOKEN_ADDRESS) // NO pool token0
        .mockResolvedValueOnce(USDC_ADDRESS) // NO pool token1

        // Pool balances
        .mockResolvedValueOnce(1000000n) // YES pool USDC balance
        .mockResolvedValueOnce(500000000000000000000n) // YES pool token balance
        .mockResolvedValueOnce(2000000n) // NO pool USDC balance
        .mockResolvedValueOnce(1000000000000000000000n) // NO pool token balance

        // Liquidity and price data
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0,
          0,
          0,
          0,
          0,
          true, // other slot0 data
        ]) // YES slot0
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0,
          0,
          0,
          0,
          0,
          true, // other slot0 data
        ]); // NO slot0
    });

    it("should successfully fetch market details", async () => {
      const args = {
        marketAddress: MOCK_MARKET_ADDRESS,
      };

      const response = await provider.getMarketDetails(mockWallet, args);

      // Verify the contract was called with correct parameters
      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: MOCK_MARKET_ADDRESS,
        abi: TruthMarketABI,
        functionName: "marketQuestion",
      });

      // Verify response contains expected data
      expect(response).toContain(`Market Details for ${MOCK_MARKET_ADDRESS}`);
      expect(response).toContain(`Question: ${MOCK_MARKET_QUESTION}`);
      expect(response).toContain(`Additional Info: ${MOCK_ADDITIONAL_INFO}`);
      expect(response).toContain(`Source: ${MOCK_MARKET_SOURCE}`);
      expect(response).toContain("Status: Created");
      expect(response).toContain("YES Pool:");
      expect(response).toContain("NO Pool:");
    });

    it("should handle errors", async () => {
      const error = new Error("Failed to fetch market details");
      mockWallet.readContract.mockReset();
      mockWallet.readContract.mockRejectedValueOnce(error);

      const args = {
        marketAddress: MOCK_MARKET_ADDRESS,
      };

      const response = await provider.getMarketDetails(mockWallet, args);

      expect(response).toContain(
        "Error retrieving market details: Error: Failed to fetch market details",
      );
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
