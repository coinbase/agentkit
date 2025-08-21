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

  it("should validate swap fee parameters when both provided", () => {
    const inputWithSwapFees = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
      swapFeeBps: 50,
    };

    const result = GetSwapPriceSchema.safeParse(inputWithSwapFees);
    expect(result.success).toBe(true);
  });

  it("should validate when only swapFeeRecipient provided (swapFeeBps defaults to 100)", () => {
    const inputWithOnlyRecipient = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      swapFeeBps: 100,
      swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
    };

    const result = GetSwapPriceSchema.safeParse(inputWithOnlyRecipient);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.swapFeeBps).toBe(100); // Default value
    }
  });

  it("should fail validation when swapFeeBps exceeds maximum", () => {
    const inputWithInvalidSwapFeeBps = {
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: "1.5",
      swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
      swapFeeBps: 1500, // Exceeds maximum of 1000
    };

    const result = GetSwapPriceSchema.safeParse(inputWithInvalidSwapFeeBps);
    expect(result.success).toBe(false);
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
        networkId: "ethereum-mainnet",
      }),
      readContract: jest.fn(),
      getPublicClient: jest.fn().mockReturnValue({
        multicall: jest.fn(),
      }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      signTypedData: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    // Reset mocks
    (global.fetch as jest.Mock).mockReset();
  });

  describe("getSwapPrice", () => {
    beforeEach(() => {
      // Mock multicall for token details (decimals and names)
      const mockMulticallResults = [
        { status: "success", result: 18 }, // sellToken decimals
        { status: "success", result: "TEST" }, // sellToken name
        { status: "success", result: 6 }, // buyToken decimals
        { status: "success", result: "USDC" }, // buyToken name
      ];

      (mockWalletProvider.getPublicClient().multicall as jest.Mock).mockResolvedValue(
        mockMulticallResults,
      );

      // Mock fetch for price API
      const mockPriceResponse = {
        buyAmount: "1000000", // 1 USDC with 6 decimals
        minBuyAmount: "990000", // 0.99 USDC with 6 decimals
        totalNetworkFee: "100000000000000", // 0.0001 ETH
        issues: { balance: null },
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
        swapFeeBps: 100,
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
      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.sellToken).toBe(MOCK_SELL_TOKEN);
      expect(parsedResponse.sellTokenName).toBe("TEST");
      expect(parsedResponse.buyToken).toBe(MOCK_BUY_TOKEN);
      expect(parsedResponse.buyTokenName).toBe("USDC");
      expect(parsedResponse.liquidityAvailable).toBe(true);
      expect(parsedResponse.balanceEnough).toBe(true);
      expect(parsedResponse.slippageBps).toBe(50);
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
        swapFeeBps: 100,
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
        swapFeeBps: 100,
      };

      const response = await provider.getSwapPrice(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Error fetching swap price");
    });

    it("should include swap fee parameters in API call when provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
        swapFeeBps: 100,
      };

      await provider.getSwapPrice(mockWalletProvider, args);

      // Verify fetch was called with swap fee parameters
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(fetchUrl).toContain("swapFeeBps=100");
      expect(fetchUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);
    });

    it("should not include swap fee parameters when not provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeBps: 100,
      };

      await provider.getSwapPrice(mockWalletProvider, args);

      // Verify fetch was called without swap fee parameters
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).not.toContain("swapFeeRecipient");
      expect(fetchUrl).not.toContain("swapFeeBps");
      expect(fetchUrl).not.toContain("swapFeeToken");
    });

    it("should include swap fee parameters with default swapFeeBps when only recipient provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeBps: 100,
        swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
      };

      await provider.getSwapPrice(mockWalletProvider, args);

      // Verify fetch was called with swap fee parameters including default swapFeeBps
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(fetchUrl).toContain("swapFeeBps=100"); // Default value
      expect(fetchUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);
    });
  });

  describe("executeSwap", () => {
    const MOCK_TX_HASH = "0xtxhash123456";

    beforeEach(() => {
      // Mock multicall for token details (decimals and names)
      const mockMulticallResults = [
        { status: "success", result: 18 }, // sellToken decimals
        { status: "success", result: "TEST" }, // sellToken name
        { status: "success", result: 6 }, // buyToken decimals
        { status: "success", result: "USDC" }, // buyToken name
      ];

      (mockWalletProvider.getPublicClient().multicall as jest.Mock).mockResolvedValue(
        mockMulticallResults,
      );

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
        status: "success",
      });
    });

    it("should execute swap successfully", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeBps: 100,
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
      expect(parsedResponse.sellTokenName).toBe("TEST");
      expect(parsedResponse.buyToken).toBe(MOCK_BUY_TOKEN);
      expect(parsedResponse.buyTokenName).toBe("USDC");
      expect(parsedResponse.transactionHash).toBe(MOCK_TX_HASH);
      expect(parsedResponse.slippageBps).toBe(50);
      expect(parsedResponse.network).toBe("ethereum-mainnet");
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
        swapFeeBps: 100,
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
        swapFeeBps: 100,
      };

      const response = await provider.executeSwap(mockWalletProvider, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("No liquidity available");
    });

    it("should include swap fee parameters in both API calls when provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
        swapFeeBps: 100,
      };

      await provider.executeSwap(mockWalletProvider, args);

      // Verify both API calls include swap fee parameters
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Check price API call
      const priceUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(priceUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(priceUrl).toContain("swapFeeBps=100");
      expect(priceUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);

      // Check quote API call
      const quoteUrl = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(quoteUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(quoteUrl).toContain("swapFeeBps=100");
      expect(quoteUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);
    });

    it("should not include swap fee parameters when not provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeBps: 100,
      };

      await provider.executeSwap(mockWalletProvider, args);

      // Verify both API calls exclude swap fee parameters
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Check price API call
      const priceUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(priceUrl).not.toContain("swapFeeRecipient");
      expect(priceUrl).not.toContain("swapFeeBps");
      expect(priceUrl).not.toContain("swapFeeToken");

      // Check quote API call
      const quoteUrl = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(quoteUrl).not.toContain("swapFeeRecipient");
      expect(quoteUrl).not.toContain("swapFeeBps");
      expect(quoteUrl).not.toContain("swapFeeToken");
    });

    it("should include swap fee parameters with default swapFeeBps when only recipient provided", async () => {
      const args = {
        sellToken: MOCK_SELL_TOKEN,
        buyToken: MOCK_BUY_TOKEN,
        sellAmount: MOCK_SELL_AMOUNT,
        slippageBps: 50,
        swapFeeBps: 100,
        swapFeeRecipient: "0xabcdef1234567890abcdef1234567890abcdef12",
      };

      await provider.executeSwap(mockWalletProvider, args);

      // Verify both API calls include swap fee parameters with default swapFeeBps
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Check price API call
      const priceUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(priceUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(priceUrl).toContain("swapFeeBps=100"); // Default value
      expect(priceUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);

      // Check quote API call
      const quoteUrl = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(quoteUrl).toContain("swapFeeRecipient=0xabcdef1234567890abcdef1234567890abcdef12");
      expect(quoteUrl).toContain("swapFeeBps=100"); // Default value
      expect(quoteUrl).toContain(`swapFeeToken=${MOCK_SELL_TOKEN}`);
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
});
