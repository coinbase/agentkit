import { zeroXActionProvider } from "./zeroXActionProvider";
import { GetSwapPriceSchema, ExecuteSwapSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Hex } from "viem";

// Mock the fetch function
global.fetch = jest.fn();

describe("ZeroX Schema Validation", () => {
  it("should validate GetSwapPrice schema with valid input", () => {
    const validInput = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      slippageBps: 50,
    };

    const result = GetSwapPriceSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should fail validation with invalid address format", () => {
    const invalidInput = {
      sellToken: "invalid-address",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      slippageBps: 50,
    };

    const result = GetSwapPriceSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it("should use default slippageBps when not provided", () => {
    const inputWithoutSlippage = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
    };

    const result = GetSwapPriceSchema.safeParse(inputWithoutSlippage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slippageBps).toBe(100); // Default value from schema
    }
  });

  it("should validate ExecuteSwap schema with valid input", () => {
    const validInput = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      slippageBps: 50,
    };

    const result = ExecuteSwapSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

describe("ZeroX Action Provider", () => {
  let provider: ReturnType<typeof zeroXActionProvider>;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  const MOCK_SELL_TOKEN = "0x1234567890123456789012345678901234567890";
  const MOCK_BUY_TOKEN = "0x0987654321098765432109876543210987654321";
  const MOCK_SELL_AMOUNT = "1.5";
  const MOCK_CHAIN_ID = 1;
  const MOCK_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

  beforeEach(() => {
    provider = zeroXActionProvider({ apiKey: "test-api-key" });

    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        chainId: MOCK_CHAIN_ID,
        protocolFamily: "evm",
      }),
      readContract: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      signTypedData: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    // Reset mocks
    (global.fetch as jest.Mock).mockReset();
  });

  describe("getSwapPrice", () => {
    beforeEach(() => {
      // Mock readContract for decimals
      mockWalletProvider.readContract
        .mockResolvedValueOnce(18) // sellToken decimals
        .mockResolvedValueOnce(6); // buyToken decimals

      // Mock fetch for price API
      const mockPriceResponse = {
        buyAmount: "1000000", // 1 USDC with 6 decimals
        minBuyAmount: "990000", // 0.99 USDC with 6 decimals
        totalNetworkFee: "100000000000000", // 0.0001 ETH
        issues: null,
        liquidityAvailable: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPriceResponse),
      });
    });

    it("should get swap price successfully", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.getSwapPrice(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      // Verify fetch was called with correct URL params
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
        "api.0x.org/swap/permit2/price",
      );
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(`chainId=${MOCK_CHAIN_ID}`);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
        `sellToken=${MOCK_SELL_TOKEN}`,
      );
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(`buyToken=${MOCK_BUY_TOKEN}`);

      // Verify response formatting
      expect(parsedResponse.sellToken).toBe(MOCK_SELL_TOKEN);
      expect(parsedResponse.buyToken).toBe(MOCK_BUY_TOKEN);
      expect(parsedResponse.liquidityAvailable).toBe(true);
      expect(parsedResponse.buyAmount).toBeDefined();
      expect(parsedResponse.minBuyAmount).toBeDefined();
    });

    it("should handle API errors", async () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: jest.fn().mockResolvedValueOnce("Invalid request parameters"),
      });

      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.getSwapPrice(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Error fetching swap price");
    });

    it("should handle fetch errors", async () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.getSwapPrice(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Error fetching swap price");
    });
  });

  describe("executeSwap", () => {
    const MOCK_TX_HASH = "0xtxhash123456";

    beforeEach(() => {
      // Mock readContract for decimals
      mockWalletProvider.readContract
        .mockResolvedValueOnce(18) // sellToken decimals
        .mockResolvedValueOnce(6); // buyToken decimals

      // Mock API responses
      const mockPriceResponse = {
        buyAmount: "1000000", // 1 USDC with 6 decimals
        minBuyAmount: "990000", // 0.99 USDC with 6 decimals
        totalNetworkFee: "100000000000000", // 0.0001 ETH
        issues: null,
        liquidityAvailable: true,
      };

      const mockQuoteResponse = {
        buyAmount: "1000000",
        minBuyAmount: "990000",
        totalNetworkFee: "100000000000000",
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x12345678",
          value: "1500000000000000000", // 1.5 ETH
          gas: "300000",
          gasPrice: "20000000000",
        },
      };

      // First fetch for price
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPriceResponse),
      });

      // Second fetch for quote
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockQuoteResponse),
      });

      // Mock transaction functions
      mockWalletProvider.sendTransaction.mockResolvedValueOnce(MOCK_TX_HASH as Hex);
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({
        transactionHash: MOCK_TX_HASH,
      });
    });

    it("should execute swap successfully", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.executeSwap(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      // Verify API calls
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
        "api.0x.org/swap/permit2/price",
      );
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
        "api.0x.org/swap/permit2/quote",
      );

      // Verify transaction was sent
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);

      // Verify response formatting
      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.sellToken).toBe(MOCK_SELL_TOKEN);
      expect(parsedResponse.buyToken).toBe(MOCK_BUY_TOKEN);
      expect(parsedResponse.swapTxHash).toBe(MOCK_TX_HASH);
    });

    it("should handle price API errors", async () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: jest.fn().mockResolvedValueOnce("Invalid request parameters"),
      });

      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.executeSwap(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Error fetching swap price");
    });

    it("should handle no liquidity available", async () => {
      (global.fetch as jest.Mock).mockReset();

      const mockPriceResponse = {
        liquidityAvailable: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPriceResponse),
      });

      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      const response = await provider.executeSwap(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("No liquidity available");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for evm networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false for non-evm networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });

  describe("isNativeEth", () => {
    it("should identify native ETH address", () => {
      // Test private method through the action methods
      const args = {
        sellToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Native ETH address
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
      };

      // We just need to mock enough to reach the method
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Test error"));
      mockWalletProvider.readContract.mockRejectedValueOnce(new Error("Test error"));

      provider.getSwapPrice(mockWalletProvider, args);

      // Native ETH should skip the decimals readContract call
      expect(mockWalletProvider.readContract).not.toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          functionName: "decimals",
        }),
      );
    });
  });
});
