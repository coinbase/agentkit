/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient, SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { CdpSmartWalletProvider } from "../../wallet-providers/cdpSmartWalletProvider";
import { CdpSmartWalletActionProvider } from "./cdpSmartWalletActionProvider";
import { ListSpendPermissionsSchema, UseSpendPermissionSchema } from "./schemas";
import * as spendPermissionUtils from "./spendPermissionUtils";

// Mock the CDP SDK and utility functions
jest.mock("@coinbase/cdp-sdk");
jest.mock("./spendPermissionUtils");

describe("CDP Smart Wallet Action Provider", () => {
  let actionProvider: CdpSmartWalletActionProvider;
  let mockWalletProvider: jest.Mocked<CdpSmartWalletProvider>;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockSmartAccount: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmartAccount = {
      useSpendPermission: jest.fn(),
      address: "0x1234567890123456789012345678901234567890",
    };

    mockCdpClient = {
      evm: {
        listSpendPermissions: jest.fn(),
      },
    } as any;

    mockWalletProvider = {
      getNetwork: jest.fn(),
      getAddress: jest.fn(),
      getClient: jest.fn(),
      smartAccount: mockSmartAccount,
    } as any;

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
        "Unsupported network for smart wallets: solana-devnet",
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

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      const evmNetwork = { protocolFamily: "evm", networkId: "base-sepolia" } as any;
      const svmNetwork = { protocolFamily: "svm", networkId: "solana-devnet" } as any;

      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
      expect(actionProvider.supportsNetwork(svmNetwork)).toBe(true);
    });
  });
});
