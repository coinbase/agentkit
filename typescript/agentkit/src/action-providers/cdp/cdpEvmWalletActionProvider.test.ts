/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient, SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { CdpEvmWalletProvider } from "../../wallet-providers/cdpEvmWalletProvider";
import { CdpEvmWalletActionProvider } from "./cdpEvmWalletActionProvider";
import { ListSpendPermissionsSchema, UseSpendPermissionSchema, SwapSchema } from "./schemas";
import * as spendPermissionUtils from "./spendPermissionUtils";
import * as swapUtils from "./swapUtils";

// Mock the CDP SDK and utility functions
jest.mock("@coinbase/cdp-sdk");
jest.mock("./spendPermissionUtils");
jest.mock("./swapUtils");

describe("CDP EVM Wallet Action Provider", () => {
  let actionProvider: CdpEvmWalletActionProvider;
  let mockWalletProvider: jest.Mocked<CdpEvmWalletProvider>;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockAccount: any;
  const mockGetTokenDetails = swapUtils.getTokenDetails as jest.Mock;
  const mockRetryWithExponentialBackoff = swapUtils.retryWithExponentialBackoff as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAccount = {
      useSpendPermission: jest.fn(),
      swap: jest.fn(),
      address: "0x1234567890123456789012345678901234567890",
    };

    mockCdpClient = {
      evm: {
        listSpendPermissions: jest.fn(),
        getAccount: jest.fn(),
        getSwapPrice: jest.fn(),
      },
    } as any;

    mockWalletProvider = {
      getNetwork: jest.fn(),
      getAddress: jest.fn(),
      getClient: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as any;

    // Default setup for utility functions
    mockRetryWithExponentialBackoff.mockImplementation(async (fn: any) => {
      return await fn();
    });

    actionProvider = new CdpEvmWalletActionProvider();
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
    });

    it("should successfully list spend permissions for EVM wallets", async () => {
      const expectedResult =
        "Found 2 spend permission(s):\n1. Token: USDC, Allowance: 500, Period: 1800 seconds, Start: 111111, End: 222222\n2. Token: ETH, Allowance: 1000, Period: 3600 seconds, Start: 123456, End: 234567";
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

    it("should handle utility function errors gracefully", async () => {
      (spendPermissionUtils.listSpendPermissionsForSpender as jest.Mock).mockResolvedValue(
        "Failed to list spend permissions: Network error",
      );

      const result = await actionProvider.listSpendPermissions(mockWalletProvider, mockArgs);

      expect(result).toBe("Failed to list spend permissions: Network error");
    });

    it("should validate input schema", () => {
      const validInput = { smartAccountAddress: "0xabcd1234567890123456789012345678901234567890" };
      const invalidInput = { wrongField: "0xabcd1234567890123456789012345678901234567890" };

      expect(() => ListSpendPermissionsSchema.parse(validInput)).not.toThrow();
      expect(() => ListSpendPermissionsSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("useSpendPermission", () => {
    const mockArgs = {
      smartAccountAddress: "0xabcd1234567890123456789012345678901234567890",
      value: "2500",
    };

    beforeEach(() => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
    });

    it("should successfully use spend permission for EVM wallets", async () => {
      const mockPermission = {
        spender: "0x1234567890123456789012345678901234567890",
        token: "USDC",
        allowance: "5000",
        period: 7200,
        start: 111111,
        end: 333333,
      };

      const mockSpendResult = {
        status: "completed",
        transactionHash: "0xdef456789",
      };

      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockAccount.useSpendPermission.mockResolvedValue(mockSpendResult);

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);

      expect(spendPermissionUtils.findLatestSpendPermission).toHaveBeenCalledWith(
        mockCdpClient,
        mockArgs.smartAccountAddress,
        "0x1234567890123456789012345678901234567890",
      );

      expect(mockCdpClient.evm.getAccount).toHaveBeenCalledWith({
        address: "0x1234567890123456789012345678901234567890",
      });

      expect(mockAccount.useSpendPermission).toHaveBeenCalledWith({
        spendPermission: mockPermission,
        value: BigInt(2500),
        network: "base-sepolia" as SpendPermissionNetwork,
      });

      expect(result).toBe(
        "Successfully spent 2500 tokens using spend permission. Transaction hash: 0xdef456789",
      );
    });

    it("should handle different network conversions", async () => {
      const testCases = [
        { networkId: "base-sepolia", expected: "base-sepolia" },
        { networkId: "base-mainnet", expected: "base" },
        { networkId: "ethereum-sepolia", expected: "ethereum-sepolia" },
        { networkId: "ethereum-mainnet", expected: "ethereum" },
      ];

      const mockPermission = { spender: "0x1234", token: "ETH" };
      const mockSpendResult = { status: "completed" };

      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockAccount.useSpendPermission.mockResolvedValue(mockSpendResult);

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockWalletProvider.getNetwork.mockReturnValue({
          protocolFamily: "evm",
          networkId: testCase.networkId,
        } as any);
        mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
        (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);

        await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);

        expect(mockAccount.useSpendPermission).toHaveBeenCalledWith({
          spendPermission: mockPermission,
          value: BigInt(2500),
          network: testCase.expected as SpendPermissionNetwork,
        });
      }
    });

    it("should handle unknown networks by passing them as-is", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "polygon-mainnet",
      } as any);

      const mockPermission = { spender: "0x1234", token: "MATIC" };
      const mockSpendResult = { status: "completed" };

      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockAccount.useSpendPermission.mockResolvedValue(mockSpendResult);

      await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);

      expect(mockAccount.useSpendPermission).toHaveBeenCalledWith({
        spendPermission: mockPermission,
        value: BigInt(2500),
        network: "polygon-mainnet" as SpendPermissionNetwork,
      });
    });

    it("should return error message for non-EVM networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "svm",
        networkId: "solana-devnet",
      } as any);

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);
      expect(result).toBe("Spend permissions are currently only supported on EVM networks.");
    });

    it("should handle spend permission not found error", async () => {
      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockRejectedValue(
        new Error("No spend permissions found for spender"),
      );

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);
      expect(result).toBe(
        "Failed to use spend permission: Error: No spend permissions found for spender",
      );
    });

    it("should handle account creation failure", async () => {
      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue({
        spender: "0x1234",
        token: "ETH",
      });
      (mockCdpClient.evm.getAccount as jest.Mock).mockRejectedValue(new Error("Account not found"));

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);
      expect(result).toBe("Failed to use spend permission: Error: Account not found");
    });

    it("should handle account use permission failure", async () => {
      const mockPermission = { spender: "0x1234", token: "ETH" };
      (spendPermissionUtils.findLatestSpendPermission as jest.Mock).mockResolvedValue(
        mockPermission,
      );
      mockAccount.useSpendPermission.mockRejectedValue(new Error("Insufficient allowance"));

      const result = await actionProvider.useSpendPermission(mockWalletProvider, mockArgs);
      expect(result).toBe("Failed to use spend permission: Error: Insufficient allowance");
    });

    it("should validate input schema", () => {
      const validInput = {
        smartAccountAddress: "0xabcd1234567890123456789012345678901234567890",
        value: "1000",
      };
      const invalidInput = {
        smartAccountAddress: "not-an-address",
        value: -100,
      };

      expect(() => UseSpendPermissionSchema.parse(validInput)).not.toThrow();
      expect(() => UseSpendPermissionSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("getSwapPrice", () => {
    const mockArgs = {
      fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
      toToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48", // USDC
      fromAmount: "0.1",
      slippageBps: 100,
    };

    beforeEach(() => {
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
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

    it("should get swap price quote on ethereum-mainnet", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      } as any);

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
        network: "ethereum",
        taker: "0x1234567890123456789012345678901234567890",
      });

      expect(parsedResult.success).toBe(true);
    });

    it("should return error for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);

      const result = await actionProvider.getSwapPrice(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'",
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
      toToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48", // USDC
      fromAmount: "0.1",
      slippageBps: 100,
    };

    beforeEach(() => {
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getAddress.mockReturnValue("0x1234567890123456789012345678901234567890");
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
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

      mockAccount.swap.mockResolvedValue({ transactionHash: "0xswap789" });

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(mockCdpClient.evm.getAccount).toHaveBeenCalledWith({
        address: "0x1234567890123456789012345678901234567890",
      });

      expect(mockAccount.swap).toHaveBeenCalledWith({
        network: "base",
        fromToken: mockArgs.fromToken,
        toToken: mockArgs.toToken,
        fromAmount: 100000000000000000n, // 0.1 ETH in wei
        slippageBps: 100,
        signerAddress: "0x1234567890123456789012345678901234567890",
      });

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.transactionHash).toBe("0xswap789");
      expect(parsedResult.fromAmount).toBe("0.1");
      expect(parsedResult.toAmount).toBe("0.99");
    });

    it("should return error for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      } as any);

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'",
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
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" }); // For approval
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" }); // For swap
      mockAccount.swap.mockResolvedValue({ transactionHash: "0xswap789" });

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

      mockAccount.swap.mockRejectedValue(new Error("Swap execution failed"));

      const result = await actionProvider.swap(mockWalletProvider, mockArgs);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Swap failed: Error: Swap execution failed");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      const evmNetwork = { protocolFamily: "evm", networkId: "base-sepolia" } as any;
      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      const svmNetwork = { protocolFamily: "svm", networkId: "solana-devnet" } as any;
      expect(actionProvider.supportsNetwork(svmNetwork)).toBe(false);
    });
  });

  describe("SwapSchema", () => {
    it("should validate correct swap input", () => {
      const validInput = {
        fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48",
        fromAmount: "0.1",
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...validInput, slippageBps: 100 });
    });

    it("should validate swap input with optional slippageBps", () => {
      const validInput = {
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48",
        toToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        fromAmount: "100",
        slippageBps: 50,
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail validation when missing required fields", () => {
      const invalidInput = {
        fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        // missing toToken and fromAmount
      };
      const result = SwapSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
