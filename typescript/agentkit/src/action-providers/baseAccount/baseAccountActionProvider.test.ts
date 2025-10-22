import { baseAccountActionProvider } from "./baseAccountActionProvider";
import {
  ListBaseAccountSpendPermissionsSchema,
  UseBaseAccountSpendPermissionSchema,
  RevokeBaseAccountSpendPermissionSchema,
} from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { getTokenDetails } from "../erc20/utils";

// Mock the getTokenDetails function from ERC20 utils
jest.mock("../erc20/utils", () => ({
  getTokenDetails: jest.fn(),
}));

// Mock the @base-org/account package to avoid ES module import issues in Jest
jest.mock("@base-org/account/spend-permission", () => ({
  fetchPermissions: jest.fn(),
  getPermissionStatus: jest.fn(),
  prepareSpendCallData: jest.fn(),
  prepareRevokeCallData: jest.fn(),
}));

const mockGetTokenDetails = getTokenDetails as jest.MockedFunction<typeof getTokenDetails>;

// Get references to the mocked functions from the mocked modules
const mockFetchPermissions = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockPrepareSpendCallData = jest.fn();
const mockPrepareRevokeCallData = jest.fn();

// Override the mocked module with our jest functions
jest.mocked(jest.requireMock("@base-org/account/spend-permission")).fetchPermissions =
  mockFetchPermissions;
jest.mocked(jest.requireMock("@base-org/account/spend-permission")).getPermissionStatus =
  mockGetPermissionStatus;
jest.mocked(jest.requireMock("@base-org/account/spend-permission")).prepareSpendCallData =
  mockPrepareSpendCallData;
jest.mocked(jest.requireMock("@base-org/account/spend-permission")).prepareRevokeCallData =
  mockPrepareRevokeCallData;

const MOCK_BASE_ACCOUNT = "0x1234567890123456789012345678901234567890";
const MOCK_SPENDER_ADDRESS = "0x9876543210987654321098765432109876543210";
const MOCK_AMOUNT_USD = 10.5;
const MOCK_TOKEN_ADDRESS = "0xA0b86a33E6441E0100d473BB88F5C8b3d8c13ab3"; // Mock USDC address

// Mock permission data
const mockPermission = {
  permissionHash: "0xmockHash",
  signature: "0xmockSignature",
  chainId: 8453,
  createdAt: 1700000000,
  permission: {
    account: MOCK_BASE_ACCOUNT,
    spender: MOCK_SPENDER_ADDRESS,
    token: MOCK_TOKEN_ADDRESS,
    allowance: "1000000000", // 1000 USDC (6 decimals) as string
    period: 86400, // 1 day
    start: 1700000000,
    end: 1700086400,
    salt: "0xsalt",
    extraData: "0x",
  },
};

const mockPermissionStatus = {
  remainingSpend: BigInt("500000000"), // 500 USDC remaining
  nextPeriodStart: new Date(1700086400 * 1000), // Convert timestamp to Date
  isActive: true,
};

// Mock token details for USDC
const mockTokenDetails = {
  name: "USD Coin",
  decimals: 6,
  balance: BigInt("1000000000"), // 1000 USDC
  formattedBalance: "1000",
};

describe("ListBaseAccountSpendPermissionsSchema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
    };

    const result = ListBaseAccountSpendPermissionsSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing invalid address", () => {
    const invalidInput = {
      baseAccount: "invalid-address",
    };
    const result = ListBaseAccountSpendPermissionsSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = ListBaseAccountSpendPermissionsSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("UseBaseAccountSpendPermissionSchema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
      amount: MOCK_AMOUNT_USD,
    };

    const result = UseBaseAccountSpendPermissionSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing negative amount", () => {
    const invalidInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
      amount: -5,
    };
    const result = UseBaseAccountSpendPermissionSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("should fail parsing zero amount", () => {
    const invalidInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
      amount: 0,
    };
    const result = UseBaseAccountSpendPermissionSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });
});

describe("RevokeBaseAccountSpendPermissionSchema", () => {
  it("should successfully parse valid input with permission index", () => {
    const validInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
      permissionIndex: 2,
    };

    const result = RevokeBaseAccountSpendPermissionSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should successfully parse valid input without permission index", () => {
    const validInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
    };

    const result = RevokeBaseAccountSpendPermissionSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing negative permission index", () => {
    const invalidInput = {
      baseAccount: MOCK_BASE_ACCOUNT,
      permissionIndex: -1,
    };
    const result = RevokeBaseAccountSpendPermissionSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });
});

describe("BaseAccountActionProvider", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = baseAccountActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_SPENDER_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
      sendTransaction: jest.fn().mockResolvedValue("0xmockTransactionHash"),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    // Reset mocks before each test
    mockFetchPermissions.mockReset();
    mockGetPermissionStatus.mockReset();
    mockPrepareSpendCallData.mockReset();
    mockPrepareRevokeCallData.mockReset();
    mockGetTokenDetails.mockReset();
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      expect(
        actionProvider.supportsNetwork({ networkId: "base-mainnet", protocolFamily: "evm" }),
      ).toBe(true);
    });

    it("should return false for other networks", () => {
      expect(
        actionProvider.supportsNetwork({ networkId: "base-sepolia", protocolFamily: "evm" }),
      ).toBe(false);
      expect(
        actionProvider.supportsNetwork({ networkId: "ethereum-mainnet", protocolFamily: "evm" }),
      ).toBe(false);
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });

  describe("listBaseAccountSpendPermissions", () => {
    it("should return empty permissions when none found", async () => {
      mockFetchPermissions.mockResolvedValue([]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
      };

      const response = await actionProvider.listBaseAccountSpendPermissions(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("No spend permissions found for Base Account");
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.spender).toBe(MOCK_SPENDER_ADDRESS);
      expect(parsedResponse.permissionsCount).toBe(0);
    });

    it("should list permissions when found", async () => {
      mockFetchPermissions.mockResolvedValue([mockPermission]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
      };

      const response = await actionProvider.listBaseAccountSpendPermissions(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.permissionsCount).toBe(1);
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.spender).toBe(MOCK_SPENDER_ADDRESS);
      expect(parsedResponse.permissions).toHaveLength(1);
      expect(parsedResponse.permissions[0].permissionIndex).toBe(1);
      expect(parsedResponse.permissions[0].token).toBe(MOCK_TOKEN_ADDRESS);
    });

    it("should normalize addresses properly", async () => {
      mockFetchPermissions.mockResolvedValue([]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT.toLowerCase(), // Test address normalization
      };

      const response = await actionProvider.listBaseAccountSpendPermissions(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT); // Should be checksummed
    });
  });

  describe("spendFromBaseAccountPermission", () => {
    it("should handle no permissions available", async () => {
      mockFetchPermissions.mockResolvedValue([]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
        amount: MOCK_AMOUNT_USD,
      };

      const response = await actionProvider.spendFromBaseAccountPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("No spend permissions found for Base Account");
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.spender).toBe(MOCK_SPENDER_ADDRESS);
    });

    it("should successfully spend from permission", async () => {
      mockFetchPermissions.mockResolvedValue([mockPermission]);
      mockGetPermissionStatus.mockResolvedValue(mockPermissionStatus);
      mockGetTokenDetails.mockResolvedValue(mockTokenDetails);
      mockPrepareSpendCallData.mockResolvedValue([
        {
          to: "0xSpendContract",
          data: "0xspendCallData",
          value: "0x0",
        },
      ]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
        amount: 10.5, // 10.5 USDC
      };

      const response = await actionProvider.spendFromBaseAccountPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.transactionHash).toBe("0xmockTransactionHash");
      expect(parsedResponse.amountSpent).toBe("10.5");
      expect(parsedResponse.tokenAddress).toBe(MOCK_TOKEN_ADDRESS);
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.permissionIndex).toBe(1);
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: "0xSpendContract",
        data: "0xspendCallData",
        value: BigInt("0x0"),
      });
    });

    it("should handle insufficient allowance", async () => {
      mockFetchPermissions.mockResolvedValue([mockPermission]);
      const lowAllowanceStatus = {
        remainingSpend: BigInt("1000000"), // Only 1 USDC remaining
        nextPeriodStart: new Date(1700086400 * 1000),
        isActive: true,
      };
      mockGetPermissionStatus.mockResolvedValue(lowAllowanceStatus);
      mockGetTokenDetails.mockResolvedValue(mockTokenDetails);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
        amount: 10.5, // Trying to spend 10.5 USDC but only 1 available
      };

      const response = await actionProvider.spendFromBaseAccountPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Insufficient remaining allowance");
      expect(parsedResponse.requestedAmount).toBe("10.5");
      expect(parsedResponse.availableAmount).toBe("1");
    });
  });

  describe("revokeBaseAccountSpendPermission", () => {
    it("should handle no permissions to revoke", async () => {
      mockFetchPermissions.mockResolvedValue([]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
      };

      const response = await actionProvider.revokeBaseAccountSpendPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("No spend permissions found for Base Account");
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.spender).toBe(MOCK_SPENDER_ADDRESS);
    });

    it("should successfully revoke a permission", async () => {
      mockFetchPermissions.mockResolvedValue([mockPermission]);
      mockPrepareRevokeCallData.mockResolvedValue({
        to: "0xRevokeContract",
        data: "0xrevokeCallData",
        value: "0x0",
      });

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
        permissionIndex: 1,
      };

      const response = await actionProvider.revokeBaseAccountSpendPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.transactionHash).toBe("0xmockTransactionHash");
      expect(parsedResponse.revokedPermissionIndex).toBe(1);
      expect(parsedResponse.baseAccount).toBe(MOCK_BASE_ACCOUNT);
      expect(parsedResponse.spender).toBe(MOCK_SPENDER_ADDRESS);
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: "0xRevokeContract",
        data: "0xrevokeCallData",
        value: BigInt("0x0"),
      });
    });

    it("should handle out of range permission index", async () => {
      mockFetchPermissions.mockResolvedValue([mockPermission]);

      const args = {
        baseAccount: MOCK_BASE_ACCOUNT,
        permissionIndex: 5, // Only 1 permission available
      };

      const response = await actionProvider.revokeBaseAccountSpendPermission(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error).toContain("Permission index 5 is out of range");
      expect(parsedResponse.availablePermissions).toBe(1);
    });
  });
});
