import { Uniswapv2ActionProvider } from "./uniswapv2ActionProvider";
import { Network } from "../../network";
import { SwapEthToUsdcSchema } from "./schemas";
import { CdpWalletProvider } from "../../wallet-providers";

describe("Uniswapv2ActionProvider", () => {
  const provider = new Uniswapv2ActionProvider();
  let mockWalletProvider: jest.Mocked<CdpWalletProvider>;

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "test-network",
      }),
      nativeTransfer: jest.fn(),
      readContract: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<CdpWalletProvider>;
  });

  describe("network support", () => {
    it("should support Base Sepolia network", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-sepolia",
        }),
      ).toBe(true);
    });

    it("should not support other networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        }),
      ).toBe(false);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
          networkId: "base-sepolia",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("action validation", () => {
    it("should validate swap ETH to USDC schema", () => {
      const validInput = {
        ethAmount: 0.01,
        slippagePercent: 0.5,
        deadlineMinutes: 20,
      };
      const parseResult = SwapEthToUsdcSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it("should reject invalid swap ETH to USDC input", () => {
      const invalidInput = {
        ethAmount: "invalid",
        slippagePercent: "too high",
      };
      const parseResult = SwapEthToUsdcSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("swapEthToUsdc action", () => {
    beforeEach(() => {
      // Mock the wallet provider to return Base Sepolia network
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      });

      // Mock readContract to return expected amounts
      mockWalletProvider.readContract.mockResolvedValue([
        BigInt("10000000000000000"), // 0.01 ETH in wei
        BigInt("20000000"), // Expected USDC amount (20 USDC with 6 decimals)
      ]);

      // Mock transaction submission
      mockWalletProvider.sendTransaction.mockResolvedValue("0xtransactionhash");
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtransactionhash",
        status: 1,
      });
    });

    it("should execute swap ETH to USDC with wallet provider", async () => {
      const args = {
        ethAmount: 0.01,
        slippagePercent: 0.5,
        deadlineMinutes: 20,
      };
      const result = await provider.swapEthToUsdc(mockWalletProvider, args);
      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
      expect(mockWalletProvider.readContract).toHaveBeenCalled();
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalled();
      expect(result).toContain("Swap completed successfully");
      expect(result).toContain("0.01 ETH");
    });

    it("should throw error when network is not Base Sepolia", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      });

      const args = {
        ethAmount: 0.01,
        slippagePercent: 0.5,
        deadlineMinutes: 20,
      };

      await expect(provider.swapEthToUsdc(mockWalletProvider, args)).rejects.toThrow(
        "This action is only supported on Base Sepolia network",
      );
    });
  });
});
