/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient, SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { CdpEvmWalletProvider } from "../../wallet-providers/cdpEvmWalletProvider";
import { CdpEvmWalletActionProvider } from "./cdpEvmWalletActionProvider";
import { ListSpendPermissionsSchema, UseSpendPermissionSchema } from "./schemas";
import * as spendPermissionUtils from "./spendPermissionUtils";

// Mock the CDP SDK and utility functions
jest.mock("@coinbase/cdp-sdk");
jest.mock("./spendPermissionUtils");

describe("CDP EVM Wallet Action Provider", () => {
  let actionProvider: CdpEvmWalletActionProvider;
  let mockWalletProvider: jest.Mocked<CdpEvmWalletProvider>;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockAccount: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAccount = {
      useSpendPermission: jest.fn(),
      address: "0x1234567890123456789012345678901234567890",
    };

    mockCdpClient = {
      evm: {
        listSpendPermissions: jest.fn(),
        getAccount: jest.fn(),
      },
    } as any;

    mockWalletProvider = {
      getNetwork: jest.fn(),
      getAddress: jest.fn(),
      getClient: jest.fn(),
    } as any;

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
});
