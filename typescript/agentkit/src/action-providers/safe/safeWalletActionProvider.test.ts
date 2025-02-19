import { SafeWalletActionProvider } from "./safeWalletActionProvider";
import { SafeWalletProvider } from "../../wallet-providers";
import { AddSignerSchema } from "./schemas";
import Safe from "@safe-global/protocol-kit";

// Mock Safe SDK modules
jest.mock("@safe-global/protocol-kit");
jest.mock("@safe-global/api-kit");

describe("SafeWalletActionProvider", () => {
  let actionProvider: SafeWalletActionProvider;
  let mockWallet: jest.Mocked<SafeWalletProvider>;
  const MOCK_SAFE_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_NEW_SIGNER = "0x9876543210987654321098765432109876543210";
  const MOCK_TRANSACTION_HASH = "0xtxhash123";

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    actionProvider = new SafeWalletActionProvider();

    // Mock SafeWalletProvider
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_SAFE_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ networkId: "base-sepolia" }),
      getSafeClient: jest.fn(),
      waitForInitialization: jest.fn().mockResolvedValue(undefined),
      addOwnerWithThreshold: jest.fn().mockResolvedValue(
        `Successfully proposed adding signer ${MOCK_NEW_SIGNER} to Safe ${MOCK_SAFE_ADDRESS}. Safe transaction hash: ${MOCK_TRANSACTION_HASH}. The other signers will need to confirm the transaction before it can be executed.`
      ),
      removeOwnerWithThreshold: jest.fn(),
      changeThreshold: jest.fn(),
    } as unknown as jest.Mocked<SafeWalletProvider>;

    // Mock Safe client methods
    const mockSafeClient = {
      getOwners: jest.fn().mockResolvedValue(["0xowner1", "0xowner2"]),
      getThreshold: jest.fn().mockResolvedValue(2),
      createTransaction: jest.fn().mockResolvedValue({
        data: { safeTxHash: MOCK_TRANSACTION_HASH },
      }),
      getPendingTransactions: jest.fn().mockResolvedValue({
        results: [],
      }),
    } as unknown as Safe;

    mockWallet.getSafeClient.mockReturnValue(mockSafeClient);
  });

  describe("Input Schema Validation", () => {
    it("should validate AddSignerSchema with valid input", () => {
      const validInput = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newSigner: MOCK_NEW_SIGNER,
      };

      const result = AddSignerSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject AddSignerSchema with invalid address", () => {
      const invalidInput = {
        safeAddress: "not-an-address",
        newSigner: "not-an-address",
      };

      const result = AddSignerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("addSigner", () => {
    it("should successfully add a new signer", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newSigner: MOCK_NEW_SIGNER,
      };

      const response = await actionProvider.addSigner(mockWallet, args);

      expect(response).toContain(`Successfully proposed adding signer ${MOCK_NEW_SIGNER}`);
      expect(response).toContain(`Safe transaction hash: ${MOCK_TRANSACTION_HASH}`);
    });

    it("should fail when adding an existing owner", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newSigner: "0xowner1", // Using an address that's already an owner
      };

      const error = new Error("Address is already an owner of this Safe");
      mockWallet.addOwnerWithThreshold.mockRejectedValue(error);

      await expect(actionProvider.addSigner(mockWallet, args)).rejects.toThrow(
        "Failed to add signer: Address is already an owner of this Safe"
      );
    });

    it("should fail when threshold is less than 1", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newSigner: MOCK_NEW_SIGNER,
        newThreshold: 0,
      };

      const error = new Error("Threshold must be at least 1");
      mockWallet.addOwnerWithThreshold.mockRejectedValue(error);

      await expect(actionProvider.addSigner(mockWallet, args)).rejects.toThrow(
        "Failed to add signer: Threshold must be at least 1"
      );
    });

    it("should fail when threshold is greater than owner count", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newSigner: MOCK_NEW_SIGNER,
        newThreshold: 4, // Would be 3 owners after adding new signer
      };

      const error = new Error("Invalid threshold: 4 cannot be greater than number of owners (3)");
      mockWallet.addOwnerWithThreshold.mockRejectedValue(error);

      await expect(actionProvider.addSigner(mockWallet, args)).rejects.toThrow(
        "Failed to add signer: Invalid threshold: 4 cannot be greater than number of owners (3)"
      );
    });
  });

  describe("removeSigner", () => {
    it("should successfully remove a signer", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        signerToRemove: "0xowner2",
        newThreshold: 1,
      };

      mockWallet.removeOwnerWithThreshold = jest.fn().mockResolvedValue(
        `Successfully proposed removing signer ${args.signerToRemove} from Safe ${MOCK_SAFE_ADDRESS}. Safe transaction hash: ${MOCK_TRANSACTION_HASH}. The other signers will need to confirm the transaction before it can be executed.`
      );

      const response = await actionProvider.removeSigner(mockWallet, args);

      expect(response).toContain(`Successfully proposed removing signer ${args.signerToRemove}`);
      expect(response).toContain(`Safe transaction hash: ${MOCK_TRANSACTION_HASH}`);
    });

    it("should fail when removing non-existent owner", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        signerToRemove: MOCK_NEW_SIGNER,
        newThreshold: 1,
      };

      const error = new Error("Address is not an owner of this Safe");
      mockWallet.removeOwnerWithThreshold = jest.fn().mockRejectedValue(error);

      await expect(actionProvider.removeSigner(mockWallet, args)).rejects.toThrow(
        "Address is not an owner of this Safe"
      );
    });
  });

  describe("changeThreshold", () => {
    it("should successfully change threshold", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newThreshold: 2,
      };

      mockWallet.changeThreshold = jest.fn().mockResolvedValue(
        `Successfully proposed changing threshold to ${args.newThreshold} for Safe ${MOCK_SAFE_ADDRESS}. Safe transaction hash: ${MOCK_TRANSACTION_HASH}. The other signers will need to confirm the transaction before it can be executed.`
      );

      const response = await actionProvider.changeThreshold(mockWallet, args);

      expect(response).toContain(`Successfully proposed changing threshold to ${args.newThreshold}`);
      expect(response).toContain(`Safe transaction hash: ${MOCK_TRANSACTION_HASH}`);
    });

    it("should fail when threshold is invalid", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        newThreshold: 3,
      };

      const error = new Error("Threshold cannot be greater than owners length");
      mockWallet.changeThreshold = jest.fn().mockRejectedValue(error);

      await expect(actionProvider.changeThreshold(mockWallet, args)).rejects.toThrow(
        "Threshold cannot be greater than owners length"
      );
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      const evmNetwork = { protocolFamily: "evm", networkId: "base-sepolia", chainId: "1" };
      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      const nonEvmNetwork = { protocolFamily: "svm", networkId: "solana", chainId: "1" };
      expect(actionProvider.supportsNetwork(nonEvmNetwork)).toBe(false);
    });
  });
}); 