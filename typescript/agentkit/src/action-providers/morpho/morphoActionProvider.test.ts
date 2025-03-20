import { encodeFunctionData, parseEther } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { approve } from "../../utils";
import { MorphoActionProvider } from "./morphoActionProvider";
import { METAMORPHO_ABI } from "./constants";

const MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_ATOMIC_ASSETS = "1000000000000000000";
const MOCK_WHOLE_ASSETS = "1.0";
const MOCK_RECEIVER_ID = "0x9876543210987654321098765432109876543210";
const MOCK_TOKEN_ADDRESS = "0x4200000000000000000000000000000000000006";
const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567 };
const MOCK_DECIMALS = 18;

jest.mock("../../utils");
const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("Morpho Action Provider", () => {
  const actionProvider = new MorphoActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_RECEIVER_ID),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "1" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockResolvedValue(MOCK_DECIMALS),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockApprove.mockResolvedValue("Approval successful");
  });

  describe("deposit", () => {
    it("should successfully deposit to Morpho vault", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        receiver: MOCK_RECEIVER_ID,
        tokenAddress: MOCK_TOKEN_ADDRESS,
      };

      const atomicAssets = parseEther(MOCK_WHOLE_ASSETS);

      const response = await actionProvider.deposit(mockWallet, args);

      expect(mockApprove).toHaveBeenCalledWith(
        mockWallet,
        MOCK_TOKEN_ADDRESS,
        MOCK_VAULT_ADDRESS,
        atomicAssets,
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_VAULT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: METAMORPHO_ABI,
          functionName: "deposit",
          args: [atomicAssets, MOCK_RECEIVER_ID],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Deposited ${MOCK_WHOLE_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
      expect(response).toContain(JSON.stringify(MOCK_RECEIPT));
    });

    it("should handle errors when depositing", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
        assets: MOCK_WHOLE_ASSETS,
        receiver: MOCK_RECEIVER_ID,
        tokenAddress: MOCK_TOKEN_ADDRESS,
      };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to deposit"));

      const response = await actionProvider.deposit(mockWallet, args);

      expect(response).toContain("Error depositing to Morpho Vault: Error: Failed to deposit");
    });
  });

  describe("withdraw", () => {
    it("should successfully withdraw from Morpho vault", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
        assets: MOCK_ATOMIC_ASSETS,
        receiver: MOCK_RECEIVER_ID,
      };

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_VAULT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: METAMORPHO_ABI,
          functionName: "withdraw",
          args: [BigInt(MOCK_ATOMIC_ASSETS), MOCK_RECEIVER_ID, MOCK_RECEIVER_ID],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Withdrawn ${MOCK_ATOMIC_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
      expect(response).toContain(JSON.stringify(MOCK_RECEIPT));
    });

    it("should handle errors when withdrawing", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
        assets: MOCK_ATOMIC_ASSETS,
        receiver: MOCK_RECEIVER_ID,
      };

      mockWallet.sendTransaction.mockRejectedValue(new Error("Failed to withdraw"));

      const response = await actionProvider.withdraw(mockWallet, args);

      expect(response).toContain("Error withdrawing from Morpho Vault: Error: Failed to withdraw");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });
      expect(result).toBe(true);
    });

    it("should return true for Base Sepolia", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      });
      expect(result).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "ethereum",
      });
      expect(result).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "base-mainnet",
      });
      expect(result).toBe(false);
    });
  });
});
