import { WalletProvider } from "../../wallet-providers";
import { walletActionProvider } from "./walletActionProvider";
import { NativeTransferSchema } from "./schemas";

describe("Wallet Action Provider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_ETH_BALANCE = 1000000000000000000n;
  const MOCK_SOL_BALANCE = 1000000000n;
  const MOCK_EVM_NETWORK = {
    protocolFamily: "evm",
    networkId: "base-sepolia",
    chainId: "123",
  };
  const MOCK_SOLANA_NETWORK = {
    protocolFamily: "svm",
    networkId: "mainnet",
  };
  const MOCK_UNKNOWN_NETWORK = {
    protocolFamily: "unknown",
    networkId: "testnet",
  };
  const MOCK_PROVIDER_NAME = "TestWallet";
  const MOCK_TRANSACTION_HASH = "0xghijkl987654321";
  const MOCK_SIGNATURE = "mock-signature";

  let mockWallet: jest.Mocked<WalletProvider>;
  const actionProvider = walletActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(MOCK_EVM_NETWORK),
      getBalance: jest.fn().mockResolvedValue(MOCK_ETH_BALANCE),
      getName: jest.fn().mockReturnValue(MOCK_PROVIDER_NAME),
      nativeTransfer: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
    } as unknown as jest.Mocked<WalletProvider>;
  });

  describe("getWalletDetails", () => {
    it("should show WEI balance for EVM networks", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_ETH_BALANCE);

      const response = await actionProvider.getWalletDetails(mockWallet, {});

      const expectedResponse = [
        "Wallet Details:",
        `- Provider: ${MOCK_PROVIDER_NAME}`,
        `- Address: ${MOCK_ADDRESS}`,
        "- Network:",
        `  * Protocol Family: ${MOCK_EVM_NETWORK.protocolFamily}`,
        `  * Network ID: ${MOCK_EVM_NETWORK.networkId}`,
        `  * Chain ID: ${MOCK_EVM_NETWORK.chainId}`,
        `- Native Balance: ${MOCK_ETH_BALANCE.toString()} WEI`,
      ].join("\n");

      expect(response).toBe(expectedResponse);
    });

    it("should show LAMPORTS balance for Solana networks", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_SOL_BALANCE);

      const response = await actionProvider.getWalletDetails(mockWallet, {});

      const expectedResponse = [
        "Wallet Details:",
        `- Provider: ${MOCK_PROVIDER_NAME}`,
        `- Address: ${MOCK_ADDRESS}`,
        "- Network:",
        `  * Protocol Family: ${MOCK_SOLANA_NETWORK.protocolFamily}`,
        `  * Network ID: ${MOCK_SOLANA_NETWORK.networkId}`,
        `  * Chain ID: N/A`,
        `- Native Balance: ${MOCK_SOL_BALANCE.toString()} LAMPORTS`,
      ].join("\n");

      expect(response).toBe(expectedResponse);
    });

    it("should handle unknown protocol families", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_UNKNOWN_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_ETH_BALANCE);

      const response = await actionProvider.getWalletDetails(mockWallet, {});

      const expectedResponse = [
        "Wallet Details:",
        `- Provider: ${MOCK_PROVIDER_NAME}`,
        `- Address: ${MOCK_ADDRESS}`,
        "- Network:",
        `  * Protocol Family: ${MOCK_UNKNOWN_NETWORK.protocolFamily}`,
        `  * Network ID: ${MOCK_UNKNOWN_NETWORK.networkId}`,
        `  * Chain ID: N/A`,
        `- Native Balance: ${MOCK_ETH_BALANCE.toString()} `,
      ].join("\n");

      expect(response).toBe(expectedResponse);
    });

    it("should handle missing network IDs gracefully", async () => {
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
      });

      const response = await actionProvider.getWalletDetails(mockWallet, {});

      expect(response).toContain("Network ID: N/A");
      expect(response).toContain("Chain ID: N/A");
      expect(response).toContain(`Native Balance: ${MOCK_ETH_BALANCE.toString()} WEI`);
    });

    it("should handle errors when getting wallet details", async () => {
      const error = new Error("Failed to get wallet details");
      mockWallet.getBalance.mockRejectedValue(error);

      const response = await actionProvider.getWalletDetails(mockWallet, {});
      expect(response).toBe(`Error getting wallet details: ${error}`);
    });
  });

  describe("Native Transfer", () => {
    const MOCK_AMOUNT = "1.5"; // 1.5 ETH/SOL
    const MOCK_DESTINATION = "0x321";

    it("should successfully parse valid input", () => {
      const validInput = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const result = NativeTransferSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = NativeTransferSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });

    it("should successfully transfer ETH", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      mockWallet.nativeTransfer.mockResolvedValue(MOCK_TRANSACTION_HASH);
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const response = await actionProvider.nativeTransfer(mockWallet, args);

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(MOCK_DESTINATION, MOCK_AMOUNT);
      expect(response).toBe(
        `Transferred ${MOCK_AMOUNT} ETH to ${MOCK_DESTINATION}\nTransaction hash: ${MOCK_TRANSACTION_HASH}`,
      );
    });

    it("should successfully transfer SOL", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      mockWallet.nativeTransfer.mockResolvedValue(MOCK_SIGNATURE);
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const response = await actionProvider.nativeTransfer(mockWallet, args);

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(MOCK_DESTINATION, MOCK_AMOUNT);
      expect(response).toBe(
        `Transferred ${MOCK_AMOUNT} SOL to ${MOCK_DESTINATION}\nSignature: ${MOCK_SIGNATURE}`,
      );
    });

    it("should handle ETH transfer errors", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const error = new Error("Failed to execute transfer");
      mockWallet.nativeTransfer.mockRejectedValue(error);

      const response = await actionProvider.nativeTransfer(mockWallet, args);
      expect(response).toBe(`Error during transaction: ${error}`);
    });

    it("should handle SOL transfer errors", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const error = new Error("Failed to execute transfer");
      mockWallet.nativeTransfer.mockRejectedValue(error);

      const response = await actionProvider.nativeTransfer(mockWallet, args);
      expect(response).toBe(`Error during transfer: ${error}`);
    });

    it("should handle unknown protocol family transfer errors", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_UNKNOWN_NETWORK);
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const error = new Error("Failed to execute transfer");
      mockWallet.nativeTransfer.mockRejectedValue(error);

      const response = await actionProvider.nativeTransfer(mockWallet, args);
      expect(response).toBe(`Error during transfer: ${error}`);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      const evmNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      const solanaNetwork = { protocolFamily: "solana", networkId: "mainnet" };
      const bitcoinNetwork = { protocolFamily: "bitcoin", networkId: "mainnet" };

      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
      expect(actionProvider.supportsNetwork(solanaNetwork)).toBe(true);
      expect(actionProvider.supportsNetwork(bitcoinNetwork)).toBe(true);
    });
  });

  describe("action provider setup", () => {
    it("should have the correct name", () => {
      expect(actionProvider.name).toBe("wallet");
    });

    it("should have empty actionProviders array", () => {
      expect(actionProvider.actionProviders).toEqual([]);
    });
  });
});
