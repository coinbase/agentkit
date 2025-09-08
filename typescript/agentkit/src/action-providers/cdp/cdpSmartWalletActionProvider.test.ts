/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient, SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { CdpSmartWalletProvider } from "../../wallet-providers/cdpSmartWalletProvider";
import { CdpSmartWalletActionProvider } from "./cdpSmartWalletActionProvider";
import { ListSpendPermissionsSchema, UseSpendPermissionSchema } from "./schemas";
import * as spendPermissionUtils from "./spendPermissionUtils";
import * as swapUtils from "./swapUtils";

// Mock the CDP SDK and utility functions
jest.mock("@coinbase/cdp-sdk");
jest.mock("./spendPermissionUtils");
jest.mock("./swapUtils");

describe("CDP Smart Wallet Action Provider", () => {
  let actionProvider: CdpSmartWalletActionProvider;
  let mockWalletProvider: jest.Mocked<CdpSmartWalletProvider>;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockSmartAccount: any;
  const mockGetTokenDetails = swapUtils.getTokenDetails as jest.Mock;
  const mockRetryWithExponentialBackoff = swapUtils.retryWithExponentialBackoff as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmartAccount = {
      useSpendPermission: jest.fn(),
      swap: jest.fn(),
      address: "0x1234567890123456789012345678901234567890",
    };

    mockCdpClient = {
      evm: {
        listSpendPermissions: jest.fn(),
        getSwapPrice: jest.fn(),
      },
    } as any;

    mockWalletProvider = {
      getNetwork: jest.fn(),
      getAddress: jest.fn(),
      getClient: jest.fn(),
      smartAccount: mockSmartAccount,
      ownerAccount: {
        type: "server",
        address: "0xowner123",
      },
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getPaymasterUrl: jest.fn(),
      getCdpSdkNetwork: jest.fn(),
    } as any;

    // Default setup for utility functions
    mockRetryWithExponentialBackoff.mockImplementation(async (fn: any) => {
      return await fn();
    });

    actionProvider = new CdpSmartWalletActionProvider();
  });

  describe("listSpendPermissions", () => {
    const mockArgs = {
      smartAccountAddress: "0xabcd1234567890123456789012345678901234567890",
    };

    beforeEach(() => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base-sepolia");
    });

    it("should successfully list spend permissions for EVM networks", async () => {
      const expectedResult =
        "Found 1 spend permission(s):\n1. Token: ETH, Allowance: 1000, Period: 3600 seconds, Start: 123456, End: 234567";
      (spendPermissionUtils.listSpendPermissionsForSpender as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const result = await actionProvider.listSpendPermissions(mockWalletProvider, mockArgs);

      expect(spendPermissionUtils.listSpendPermissionsForSpender).toHaveBeenCalledWith(
        mockCdpClient,
        mockArgs.smartAccountAddress,
        "0x1234567890123456789012345678901234567890",
      );
      expect(result).toBe(expectedResult);
    });

    it("should return error message for non-EVM networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "svm",
        networkId: "solana-devnet",
      } as any);

      const result = await actionProvider.listSpendPermissions(mockWalletProvider, mockArgs);

      expect(result).toBe("Spend permissions are currently only supported on EVM networks.");
      expect(spendPermissionUtils.listSpendPermissionsForSpender).not.toHaveBeenCalled();
    });

    it("should validate input schema", () => {
      const validInput = { smartAccountAddress: "0xabcd1234567890123456789012345678901234567890" };
      const invalidInput = { invalidField: "invalid" };

      expect(() => ListSpendPermissionsSchema.parse(validInput)).not.toThrow();
      expect(() => ListSpendPermissionsSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("useSpendPermission", () => {
    const mockArgs = {
      smartAccountAddress: "0xabcd1234567890123456789012345678901234567890",
      value: "1000",
    };

    beforeEach(() => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base-sepolia");
    });

    it("should successfully use spend permission for EVM networks", async () => {
      const mockPermission = {
        spender: "0x1234567890123456789012345678901234567890",
        token: "ETH",
        allowance: "1000",
        period: 3600,
        start: 123456,
        end: 234567,
      };

      const mockSpendResult = {
        status: "completed",
        transactionHash: "0xabcd1234",
      };

      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockSmartAccount.useSpendPermission.mockResolvedValue(mockSpendResult);

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);

      expect(spendPermissionUtils.findLatestSpendPermission).toHaveBeenCalledWith(
        mockCdpClient,
        mockArgs.smartAccountAddress,
        "0x1234567890123456789012345678901234567890",
      );

      expect(mockSmartAccount.useSpendPermission).toHaveBeenCalledWith({
        spendPermission: mockPermission,
        value: BigInt(1000),
        network: "base-sepolia" as SpendPermissionNetwork,
      });

      expect(result).toBe(
        "Successfully spent 1000 tokens using spend permission. Status: completed",
      );
    });

    it("should handle base-mainnet network conversion", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base");

      const mockPermission = { spender: "0x1234", token: "ETH" };
      const mockSpendResult = { status: "completed" };

      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockSmartAccount.useSpendPermission.mockResolvedValue(mockSpendResult);

      await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);

      expect(mockSmartAccount.useSpendPermission).toHaveBeenCalledWith({
        spendPermission: mockPermission,
        value: BigInt(1000),
        network: "base" as SpendPermissionNetwork,
      });
    });

    it("should throw error for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      } as any);
      mockWalletProvider.getCdpSdkNetwork.mockImplementation(() => {
        throw new Error("Unsupported network for smart wallets: ethereum-mainnet");
      });

      await expect(actionProvider.useSpendPermission(mockWalletProvider, mockArgs)).rejects.toThrow(
        "Unsupported network for smart wallets: ethereum-mainnet",
      );
    });

    it("should return error message for non-EVM networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "svm",
        networkId: "solana-devnet",
      } as any);

      await expect(actionProvider.useSpendPermission(mockWalletProvider, mockArgs)).rejects.toThrow(
        "Spend permissions are currently only supported on EVM networks.",
      );
    });

    it("should handle spend permission not found error", async () => {
      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockRejectedValue(
        new Error("No spend permissions found"),
      );

      await expect(actionProvider.useSpendPermission(mockWalletProvider, mockArgs)).rejects.toThrow(
        "Failed to use spend permission: Error: No spend permissions found",
      );
    });

    it("should handle smart account use permission failure", async () => {
      const mockPermission = { spender: "0x1234", token: "ETH" };
      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockSmartAccount.useSpendPermission.mockRejectedValue(new Error("Transaction failed"));

      await expect(actionProvider.useSpendPermission(mockWalletProvider, mockArgs)).rejects.toThrow(
        "Failed to use spend permission: Error: Transaction failed",
      );
    });

    it("should validate input schema", () => {
      const validInput = {
        smartAccountAddress: "0xabcd1234567890123456789012345678901234567890",
        value: "1000",
      };
      const invalidInput = {
        wrongField: "0xabcd1234567890123456789012345678901234567890",
        // Missing required fields
      };

      expect(() => UseSpendPermissionSchema.parse(validInput)).not.toThrow();
      expect(() => UseSpendPermissionSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("getSwapPrice", () => {
    const mockArgs = {
      fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
      toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
      fromAmount: "0.1",
      slippageBps: 100,
    };

    beforeEach(() => {
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base");
      mockGetTokenDetails.mockResolvedValue({
        fromTokenDecimals: 18,
        toTokenDecimals: 6,
        fromTokenName: "ETH",
        toTokenName: "USDC",
      });
    });

    it("should get swap price quote on base-mainnet", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        toAmount: "990000", // 0.99 USDC
        minToAmount: "980000", // 0.98 USDC
        liquidityAvailable: true,
        issues: {},
      });

      const result = await actionProvider.getSwapPrice(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(mockCdpClient.evm.getSwapPrice).toHaveBeenCalledWith({
        fromToken: mockArgs.fromToken,
        toToken: mockArgs.toToken,
        fromAmount: 100000000000000000n, // 0.1 ETH in wei
        network: "base",
        taker: "0x1234567890123456789012345678901234567890",
      });

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.fromAmount).toBe("0.1");
      expect(parsedResult.toAmount).toBe("0.99");
      expect(parsedResult.liquidityAvailable).toBe(true);
    });

    it("should get swap price quote on base-sepolia", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base-sepolia");

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        toAmount: "990000",
        minToAmount: "980000",
        liquidityAvailable: true,
        issues: {},
      });

      const result = await actionProvider.getSwapPrice(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(mockCdpClient.evm.getSwapPrice).toHaveBeenCalledWith({
        fromToken: mockArgs.fromToken,
        toToken: mockArgs.toToken,
        fromAmount: 100000000000000000n,
        network: "base-sepolia",
        taker: "0x1234567890123456789012345678901234567890",
      });

      expect(parsedResult.success).toBe(true);
    });

    it("should return error for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      } as any);

      const result = await actionProvider.getSwapPrice(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "CDP Swap API for smart wallets is currently only supported on Base networks",
      );
    });

    it("should handle swap price API errors", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockRejectedValue(new Error("API Error"));

      const result = await actionProvider.getSwapPrice(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Error fetching swap price: Error: API Error");
    });
  });

  describe("swap", () => {
    const mockArgs = {
      fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
      toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
      fromAmount: "0.1",
      slippageBps: 100,
    };

    beforeEach(() => {
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      mockWalletProvider.getCdpSdkNetwork.mockReturnValue("base");
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValue({ status: "complete" });
      mockWalletProvider.getPaymasterUrl.mockReturnValue("https://paymaster.example");
      mockGetTokenDetails.mockResolvedValue({
        fromTokenDecimals: 18,
        toTokenDecimals: 6,
        fromTokenName: "ETH",
        toTokenName: "USDC",
      });
    });

    it("should execute swap on base-mainnet", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {},
        toAmount: "990000", // 0.99 USDC
        minToAmount: "980000", // 0.98 USDC
      });

      mockSmartAccount.swap.mockResolvedValue({ userOpHash: "0xswap789" });

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(mockSmartAccount.swap).toHaveBeenCalledWith({
        network: "base",
        fromToken: mockArgs.fromToken,
        toToken: mockArgs.toToken,
        fromAmount: 100000000000000000n, // 0.1 ETH in wei
        slippageBps: 100,
        paymasterUrl: "https://paymaster.example",
        signerAddress: "0xowner123",
      });

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.transactionHash).toBe("0xswap789");
      expect(parsedResult.fromAmount).toBe("0.1");
      expect(parsedResult.toAmount).toBe("0.99");
    });

    it("should return error for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      } as any);

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "CDP Swap API for smart wallets is currently only supported on Base networks",
      );
    });

    it("should throw error for local owner account", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockWalletProvider.ownerAccount = {
        type: "local",
        address: "0xlocal123",
      } as any;

      await expect(actionProvider.swap(mockWalletProvider, mockArgs)).rejects.toThrow(
        "Smart wallet owner account is not a CDP server account",
      );
    });

    it("should return error when liquidity is not available", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: false,
        issues: {},
        toAmount: "0",
        minToAmount: "0",
      });

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("No liquidity available to swap");
    });

    it("should return error when balance is insufficient", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {
          balance: {
            currentBalance: "50000000000000000", // 0.05 ETH
          },
        },
        toAmount: "990000",
        minToAmount: "980000",
      });

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Balance is not enough to perform swap");
      expect(parsedResult.error).toContain("but only have 0.05 ETH");
    });

    it("should handle approval transaction when allowance is insufficient", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {
          allowance: {
            requiredAllowance: "100000000000000000",
            currentAllowance: "0",
          },
        },
        toAmount: "990000",
        minToAmount: "980000",
      });

      mockWalletProvider.sendTransaction.mockResolvedValue("0xapproval123");
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({ status: "complete" }); // For approval
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({ status: "complete" }); // For swap
      mockSmartAccount.swap.mockResolvedValue({ userOpHash: "0xswap789" });

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(mockWalletProvider.sendTransaction).toHaveBeenCalled();
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.approvalTxHash).toBe("0xapproval123");
      expect(parsedResult.transactionHash).toBe("0xswap789");
    });

    it("should handle swap execution errors", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      } as any);

      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {},
        toAmount: "990000",
        minToAmount: "980000",
      });

      mockSmartAccount.swap.mockRejectedValue(new Error("Swap execution failed"));

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Swap failed: Error: Swap execution failed");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      const evmNetwork = { protocolFamily: "evm", networkId: "base-sepolia" } as any;
      const svmNetwork = { protocolFamily: "svm", networkId: "solana-devnet" } as any;

      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
      expect(actionProvider.supportsNetwork(svmNetwork)).toBe(true);
    });
  });
});
