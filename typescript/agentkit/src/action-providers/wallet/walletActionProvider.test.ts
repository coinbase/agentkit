import { WalletProvider } from "../../wallet-providers";
import { walletActionProvider } from "./walletActionProvider";
import { NativeTransferSchema } from "./schemas";

describe("Wallet Action Provider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_BALANCE = 1000000000000000000n; // 1 ETH in wei
  const MOCK_NETWORK = {
    protocolFamily: "evm",
    networkId: "base-sepolia",
    chainId: "123",
  };
  const MOCK_PROVIDER_NAME = "TestWallet";
  const MOCK_TRANSACTION_HASH = "0xghijkl987654321";

  let mockWallet: jest.Mocked<WalletProvider>;
  const actionProvider = walletActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(MOCK_NETWORK),
      getBalance: jest.fn().mockResolvedValue(MOCK_BALANCE),
      getName: jest.fn().mockReturnValue(MOCK_PROVIDER_NAME),
      nativeTransfer: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
    } as unknown as jest.Mocked<WalletProvider>;
  });

  describe("getWalletDetails", () => {
    it("should successfully get wallet details", async () => {
      const response = await actionProvider.getWalletDetails(mockWallet, {});

      expect(mockWallet.getAddress).toHaveBeenCalled();
      expect(mockWallet.getNetwork).toHaveBeenCalled();
      expect(mockWallet.getBalance).toHaveBeenCalled();
      expect(mockWallet.getName).toHaveBeenCalled();

      const expectedResponse = `Wallet Details:
- Provider: ${MOCK_PROVIDER_NAME}
- Address: ${MOCK_ADDRESS}
- Network: 
  * Protocol Family: ${MOCK_NETWORK.protocolFamily}
  * Network ID: ${MOCK_NETWORK.networkId}
  * Chain ID: ${MOCK_NETWORK.chainId}
- ETH Balance: 1.000000 ETH
- Native Balance: ${MOCK_BALANCE.toString()} WEI`;

      expect(response).toBe(expectedResponse);
    });

    it("should handle missing network IDs gracefully", async () => {
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
      });

      const response = await actionProvider.getWalletDetails(mockWallet, {});

      expect(response).toContain("Network ID: N/A");
      expect(response).toContain("Chain ID: N/A");
    });

    it("should handle errors when getting wallet details", async () => {
      const error = new Error("Failed to get wallet details");
      mockWallet.getBalance.mockRejectedValue(error);

      const response = await actionProvider.getWalletDetails(mockWallet, {});
      expect(response).toBe(`Error getting wallet details: ${error}`);
    });
  });

  describe("Native Transfer", () => {
    const MOCK_AMOUNT = "1.5"; // 1.5 ETH
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

    it("should successfully transfer assets", async () => {
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const response = await actionProvider.nativeTransfer(mockWallet, args);

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(MOCK_DESTINATION, MOCK_AMOUNT);
      expect(response).toBe(
        `Transferred ${MOCK_AMOUNT} ETH to ${MOCK_DESTINATION}.\nTransaction hash: ${MOCK_TRANSACTION_HASH}`,
      );
    });

    it("should handle transfer errors", async () => {
      const args = {
        to: MOCK_DESTINATION,
        value: MOCK_AMOUNT,
      };

      const error = new Error("Failed to execute transfer");
      mockWallet.nativeTransfer.mockRejectedValue(error);

      const response = await actionProvider.nativeTransfer(mockWallet, args);
      expect(response).toBe(`Error transferring the asset: ${error}`);
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
