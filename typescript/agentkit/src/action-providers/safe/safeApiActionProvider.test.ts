import { safeApiActionProvider } from "./safeApiActionProvider";
import { SafeInfoSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import SafeApiKit from "@safe-global/api-kit";

// Mock the Safe API Kit
jest.mock("@safe-global/api-kit");

describe("Safe API Action Provider Input Schemas", () => {
  describe("Safe Info Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        safeAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
      };

      const result = SafeInfoSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid address", () => {
      const invalidInput = {
        safeAddress: "invalid-address",
      };
      const result = SafeInfoSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = SafeInfoSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Safe API Action Provider", () => {
  let actionProvider: ReturnType<typeof safeApiActionProvider>;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockSafeApiKit: jest.Mocked<SafeApiKit>;

  const MOCK_SAFE_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_NETWORK = "base-sepolia";
  const MOCK_BALANCE = BigInt(1000000000000000000); // 1 ETH in wei

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock SafeApiKit methods first
    mockSafeApiKit = {
      getSafeInfo: jest.fn(),
      getPendingTransactions: jest.fn(),
    } as unknown as jest.Mocked<SafeApiKit>;

    // Set up the mock implementation before creating actionProvider
    (SafeApiKit as jest.Mock).mockImplementation(() => mockSafeApiKit);

    actionProvider = safeApiActionProvider({ networkId: MOCK_NETWORK });

    // Mock wallet provider
    mockWallet = {
      getPublicClient: jest.fn().mockReturnValue({
        getBalance: jest.fn().mockResolvedValue(MOCK_BALANCE),
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("safeInfo", () => {
    it("should successfully get Safe info", async () => {
      const mockSafeInfo = {
        address: MOCK_SAFE_ADDRESS,
        owners: ["0x123", "0x456"],
        threshold: 2,
        modules: ["0x789"],
        nonce: "1",
        singleton: "0x123",
        fallbackHandler: "0x456",
        guard: "0x789",
        version: "1.0.0",
      };

      const mockPendingTransactions = {
        results: [
          {
            safeTxHash: "0xabc",
            isExecuted: false,
            confirmationsRequired: 2,
            confirmations: [{ owner: "0x123" }, { owner: "0x456" }],
          },
        ],
        count: 1,
      };

      mockSafeApiKit.getSafeInfo.mockResolvedValue(mockSafeInfo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSafeApiKit.getPendingTransactions.mockResolvedValue(mockPendingTransactions as any);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      const response = await actionProvider.safeInfo(mockWallet, args);

      // Verify response contains expected information
      expect(response).toContain(`Safe at address: ${MOCK_SAFE_ADDRESS}`);
      expect(response).toContain("2 owners: 0x123, 0x456");
      expect(response).toContain("Threshold: 2");
      expect(response).toContain("Nonce: 1");
      expect(response).toContain("Modules: 0x789");
      expect(response).toContain("Balance: 1 ETH");
      expect(response).toContain("Pending transactions: 1");
      expect(response).toContain(
        "Transaction 0xabc (2/2 confirmations, confirmed by: 0x123, 0x456)",
      );
    });

    it("should handle errors when getting Safe info", async () => {
      const error = new Error("Failed to get Safe info");
      mockSafeApiKit.getSafeInfo.mockRejectedValue(error);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      const response = await actionProvider.safeInfo(mockWallet, args);
      expect(response).toBe(`Safe info: Error connecting to Safe: ${error.message}`);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = actionProvider.supportsNetwork({ protocolFamily: "evm" } as any);
      expect(result).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = actionProvider.supportsNetwork({ protocolFamily: "solana" } as any);
      expect(result).toBe(false);
    });
  });
});
