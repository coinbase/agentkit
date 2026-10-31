import { UniswapV4ActionProvider, uniswapV4ActionProvider } from "./uniswapV4ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { GetV4QuoteSchema, SwapExactInputSchema, SwapExactOutputSchema } from "./schemas";
import { Network } from "../../network";
import { parseUnits, parseEther, getAddress } from "viem";

// Helper to generate properly checksummed addresses
const USDC_ADDRESS = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const WETH_ADDRESS = getAddress("0x4200000000000000000000000000000000000006");
const RECIPIENT_ADDRESS = getAddress("0x1234567890123456789012345678901234567890");

// Mock the viem module
jest.mock("viem", () => ({
  ...jest.requireActual("viem"),
  encodeFunctionData: jest.fn().mockReturnValue("0xencoded"),
}));

describe("UniswapV4ActionProvider", () => {
  let provider: UniswapV4ActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const mockNetwork: Network = {
    networkId: "base-mainnet",
    chainId: "8453",
    protocolFamily: "evm",
  };

  beforeEach(() => {
    provider = new UniswapV4ActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(RECIPIENT_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(mockNetwork),
      sendTransaction: jest.fn().mockResolvedValue("0xtxhash"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({
        status: "success",
        transactionHash: "0xtxhash",
      }),
      readContract: jest.fn(),
      getBalance: jest.fn().mockResolvedValue(parseUnits("1", 18)),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct name", () => {
      expect(provider).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((provider as any).name).toBe("uniswap_v4");
    });
  });

  describe("uniswapV4ActionProvider factory", () => {
    it("should create a new UniswapV4ActionProvider instance", () => {
      const instance = uniswapV4ActionProvider();
      expect(instance).toBeInstanceOf(UniswapV4ActionProvider);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for supported networks", () => {
      expect(provider.supportsNetwork(mockNetwork)).toBe(true);
      expect(
        provider.supportsNetwork({
          networkId: "base-sepolia",
          chainId: "84532",
          protocolFamily: "evm",
        }),
      ).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      expect(
        provider.supportsNetwork({
          networkId: "ethereum-mainnet",
          chainId: "1",
          protocolFamily: "evm",
        }),
      ).toBe(false);
      expect(
        provider.supportsNetwork({
          networkId: "solana",
          protocolFamily: "solana",
        }),
      ).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      expect(
        provider.supportsNetwork({
          networkId: "base-mainnet",
          chainId: "8453",
          protocolFamily: "evm",
        }),
      ).toBe(true);

      expect(
        provider.supportsNetwork({
          networkId: "solana",
          protocolFamily: "solana",
        }),
      ).toBe(false);
    });

    it("should return false when networkId is missing", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
        }),
      ).toBe(false);
    });
  });

  describe("getV4Quote", () => {
    it("should return a quote for valid inputs", async () => {
      // Mock token info calls - when tokenIn is "native", getTokenInfo doesn't call readContract
      // So we only mock for tokenOut (decimals + symbol) and quoter
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter result

      const result = await provider.getV4Quote(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Quote for Uniswap V4 swap:");
      expect(result).toContain("Expected output:");
      expect(result).toContain("Minimum output");
      expect(result).toContain("Network: base-mainnet");
      expect(mockWallet.readContract).toHaveBeenCalled();
    });

    it("should use default slippage when not provided", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      const result = await provider.getV4Quote(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("(0.5% slippage)");
    });

    it("should return error for unsupported network", async () => {
      mockWallet.getNetwork.mockReturnValue({
        networkId: "solana",
        protocolFamily: "solana",
      } as Network);

      const result = await provider.getV4Quote(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("not available on solana");
    });

    it("should handle quoter revert gracefully", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockRejectedValue(new Error("execution reverted")); // quoter fails

      const result = await provider.getV4Quote(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("No quote available");
    });
  });

  describe("swapExactInput", () => {
    it("should execute swap for valid inputs", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10")); // ETH balance check
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Successfully swapped on Uniswap V4!");
      expect(result).toContain("ETH");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should execute swap with custom recipient", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
        recipient: RECIPIENT_ADDRESS,
      });

      expect(result).toContain("Successfully swapped");
      // Should have sent transaction with recipient encoded in the data
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should default to wallet address when recipient not provided", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
        // No recipient provided
      });

      // Transaction should have defaulted to wallet address as expected
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should handle ERC20 token approval", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenIn decimals (USDC)
        .mockResolvedValueOnce("USDC") // tokenIn symbol
        .mockResolvedValueOnce(18) // tokenOut decimals (WETH)
        .mockResolvedValueOnce("WETH") // tokenOut symbol
        .mockResolvedValueOnce(parseUnits("10000", 6)) // balance check
        .mockResolvedValueOnce(0n) // allowance
        .mockResolvedValueOnce([parseUnits("0.0005", 18), 0n, 0, 0n]); // quoter

      await provider.swapExactInput(mockWallet, {
        tokenIn: USDC_ADDRESS,
        tokenOut: WETH_ADDRESS,
        amountIn: "100",
        slippageTolerance: "0.5",
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2); // approve + swap
    });

    it("should return error for insufficient native ETH balance", async () => {
      mockWallet.getBalance.mockResolvedValue(parseUnits("0.01", 18)); // Low balance

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Insufficient ETH balance");
    });

    it("should return error for insufficient ERC20 balance", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenIn decimals
        .mockResolvedValueOnce("USDC") // tokenIn symbol
        .mockResolvedValueOnce(18) // tokenOut decimals
        .mockResolvedValueOnce("WETH") // tokenOut symbol
        .mockResolvedValueOnce(parseUnits("10", 6)); // Low balance

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: USDC_ADDRESS,
        tokenOut: WETH_ADDRESS,
        amountIn: "100",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Insufficient USDC balance");
    });

    it("should return error for unsupported network", async () => {
      mockWallet.getNetwork.mockReturnValue({
        networkId: "unsupported-network",
        protocolFamily: "evm",
      } as Network);

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("not available on unsupported-network");
    });

    it("should handle reverted transaction", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      mockWallet.waitForTransactionReceipt.mockResolvedValue({
        status: "reverted",
        transactionHash: "0xtxhash",
      });

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Swap failed");
      expect(result).toContain("reverted");
    });

    it("should handle insufficient funds error", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      mockWallet.sendTransaction.mockRejectedValue(new Error("insufficient funds"));

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Insufficient");
    });

    it("should handle slippage exceeded error", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("2000", 6), 0n, 0, 0n]); // quoter

      mockWallet.sendTransaction.mockRejectedValue(new Error("Too little received"));

      const result = await provider.swapExactInput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("slippage tolerance");
    });
  });

  describe("swapExactOutput", () => {
    it("should execute swap for valid inputs", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoter

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Successfully swapped on Uniswap V4!");
      expect(result).toContain("Received: 1000 USDC (exact)");
    });

    it("should execute swap with custom recipient", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoter

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
        recipient: RECIPIENT_ADDRESS,
      });

      expect(result).toContain("Successfully swapped");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should return error for unsupported network", async () => {
      mockWallet.getNetwork.mockReturnValue({
        networkId: "unsupported-network",
        protocolFamily: "evm",
      } as Network);

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("not available on unsupported-network");
    });

    it("should handle reverted transaction", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoter

      mockWallet.waitForTransactionReceipt.mockResolvedValue({
        status: "reverted",
        transactionHash: "0xtxhash",
      });

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Swap failed");
      expect(result).toContain("reverted");
    });

    // SECURITY FIX TESTS

    it("should check balance before swapExactOutput with native ETH", async () => {
      // Low balance that won't cover max input with slippage
      mockWallet.getBalance.mockResolvedValue(parseEther("0.1"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals (USDC)
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoter returns 0.5 ETH needed

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      // Should fail due to insufficient balance
      expect(result).toContain("Insufficient ETH balance");
      expect(result).toContain("slippage buffer");
      // Should not send any transaction
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should check balance before swapExactOutput with ERC20", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenIn decimals (USDC)
        .mockResolvedValueOnce("USDC") // tokenIn symbol
        .mockResolvedValueOnce(18) // tokenOut decimals (WETH)
        .mockResolvedValueOnce("WETH") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("1000", 6), 0n, 0, 0n]) // quoter returns 1000 USDC needed
        .mockResolvedValueOnce(parseUnits("500", 6)); // balance only 500 USDC

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: USDC_ADDRESS,
        tokenOut: WETH_ADDRESS,
        amountOut: "0.5",
        slippageTolerance: "0.5",
      });

      // Should fail due to insufficient balance
      expect(result).toContain("Insufficient USDC balance");
      expect(result).toContain("slippage buffer");
      // Should not send any transaction
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should only approve required amount, not 1M tokens", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenIn decimals (USDC)
        .mockResolvedValueOnce("USDC") // tokenIn symbol
        .mockResolvedValueOnce(18) // tokenOut decimals (WETH)
        .mockResolvedValueOnce("WETH") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("100", 6), 0n, 0, 0n]) // quoter result
        .mockResolvedValueOnce(parseUnits("10000", 6)) // sufficient balance
        .mockResolvedValueOnce(0n); // zero current allowance

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: USDC_ADDRESS,
        tokenOut: WETH_ADDRESS,
        amountOut: "0.05",
        slippageTolerance: "0.5",
      });

      // Verify that sendTransaction was called for approval and swap
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2); // approve + swap

      // Verify success
      expect(result).toContain("Successfully swapped");
    });

    it("should use quoteExactOutputSingle to get expected input", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoteExactOutputSingle result

      await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      // Verify that quoteExactOutputSingle was called
      const _quoterCalls = mockWallet.readContract.mock.calls.filter(
        call => call[0].address && call[0].functionName === "quoteExactOutputSingle",
      );

      // Should have called quoter
      expect(mockWallet.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "quoteExactOutputSingle",
          args: expect.arrayContaining([
            expect.objectContaining({
              amountOut: parseUnits("1000", 6),
            }),
          ]),
        }),
      );
    });

    it("should handle quoter failure gracefully", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockRejectedValue(new Error("execution reverted")); // quoter fails

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("Could not get quote");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle 'Too much requested' slippage error", async () => {
      mockWallet.getBalance.mockResolvedValue(parseEther("10"));
      mockWallet.readContract
        .mockResolvedValueOnce(6) // tokenOut decimals
        .mockResolvedValueOnce("USDC") // tokenOut symbol
        .mockResolvedValueOnce([parseUnits("0.5", 18), 0n, 0, 0n]); // quoter

      mockWallet.sendTransaction.mockRejectedValue(new Error("Too much requested"));

      const result = await provider.swapExactOutput(mockWallet, {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
        slippageTolerance: "0.5",
      });

      expect(result).toContain("slippage tolerance");
    });
  });

  describe("schemas", () => {
    it("GetV4QuoteSchema should validate valid inputs", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1.5",
        slippageTolerance: "0.5",
      };

      const result = GetV4QuoteSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("GetV4QuoteSchema should reject invalid token addresses", () => {
      const invalidInput = {
        tokenIn: "invalid",
        tokenOut: USDC_ADDRESS,
        amountIn: "1.5",
      };

      const result = GetV4QuoteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    // SECURITY FIX: Checksum validation tests
    it("GetV4QuoteSchema should reject non-checksummed addresses", () => {
      const invalidInput = {
        tokenIn: "native",
        // Lowercase address (invalid checksum)
        tokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        amountIn: "1.5",
      };

      const result = GetV4QuoteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("GetV4QuoteSchema should accept properly checksummed addresses", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS, // Properly checksummed
        amountIn: "1.5",
      };

      const result = GetV4QuoteSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("SwapExactInputSchema should validate valid inputs", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1.5",
      };

      const result = SwapExactInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("SwapExactInputSchema should accept optional recipient", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1.5",
        recipient: RECIPIENT_ADDRESS,
      };

      const result = SwapExactInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("SwapExactOutputSchema should validate valid inputs", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountOut: "1000",
      };

      const result = SwapExactOutputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("schemas should reject negative amounts", () => {
      const invalidInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "-1.5",
      };

      const result = SwapExactInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("schemas should reject zero amounts", () => {
      const invalidInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "0",
      };

      const result = SwapExactInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    // SECURITY FIX: Slippage validation tests
    it("schemas should reject slippage > 50%", () => {
      const invalidInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "100", // 100% is too high
      };

      const result = SwapExactInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("schemas should reject negative slippage", () => {
      const invalidInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "-5",
      };

      const result = SwapExactInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("schemas should accept slippage between 0.01 and 50%", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "5", // 5% is valid
      };

      const result = SwapExactInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("schemas should reject slippage = 0", () => {
      const invalidInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
        slippageTolerance: "0",
      };

      const result = SwapExactInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("schemas should accept lowercase 'native'", () => {
      const validInput = {
        tokenIn: "native",
        tokenOut: USDC_ADDRESS,
        amountIn: "1",
      };

      const result = SwapExactInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});
