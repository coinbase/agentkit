import { WalletProvider, EvmWalletProvider } from "../../wallet-providers";
import { walletActionProvider } from "./walletActionProvider";
import { GetBalanceSchema, NativeTransferSchema, ReturnNativeBalanceSchema } from "./schemas";
import { formatUnits, parseUnits } from "viem";

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
        `- Native Balance: ${formatUnits(MOCK_ETH_BALANCE, 18)} ETH`,
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
        `- Native Balance: ${formatUnits(MOCK_SOL_BALANCE, 9)} SOL`,
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

  describe("getBalance", () => {
    it("should return native balance for EVM networks", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_ETH_BALANCE);

      const response = await actionProvider.getBalance(mockWallet, {});

      expect(response).toBe(`Native balance at address ${MOCK_ADDRESS}: ${MOCK_ETH_BALANCE}`);
    });

    it("should return native balance for Solana networks", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_SOL_BALANCE);

      const response = await actionProvider.getBalance(mockWallet, {});

      expect(response).toBe(`Native balance at address ${MOCK_ADDRESS}: ${MOCK_SOL_BALANCE}`);
    });

    it("should handle errors when getting balance", async () => {
      const error = new Error("Failed to get balance");
      mockWallet.getBalance.mockRejectedValue(error);

      const response = await actionProvider.getBalance(mockWallet, {});
      expect(response).toBe(`Error getting balance: ${error}`);
    });

    it("should validate GetBalanceSchema with empty input", () => {
      const result = GetBalanceSchema.safeParse({});
      expect(result.success).toBe(true);
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

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(
        MOCK_DESTINATION,
        parseUnits(MOCK_AMOUNT, 18).toString(),
      );
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

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(
        MOCK_DESTINATION,
        parseUnits(MOCK_AMOUNT, 9).toString(),
      );
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

  describe("Return Native Balance", () => {
    const MOCK_DESTINATION = "0x6fb9e80dDd0f5DC99D7cB38b07e8b298A57bF253";
    const MOCK_MAX_FEE_PER_GAS = 10000000000n; // 10 gwei
    // Must match the EVM_GAS_BUDGET constant defined in walletActionProvider.ts
    const EVM_GAS_BUDGET = 21000n * 2n; // 42000 (2x buffer for provider gas-limit multipliers)
    const MOCK_GAS_COST = EVM_GAS_BUDGET * MOCK_MAX_FEE_PER_GAS;

    // Use Object.create to get an EvmWalletProvider instance without triggering the
    // analytics-tracking fetch in the WalletProvider constructor.
    let mockEvmWallet: EvmWalletProvider;
    const mockPublicClient = {
      estimateFeesPerGas: jest.fn().mockResolvedValue({
        maxFeePerGas: MOCK_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: 1000000000n,
      }),
    };

    beforeEach(() => {
      // Object.create bypasses the constructor but keeps instanceof EvmWalletProvider true.
      mockEvmWallet = Object.create(EvmWalletProvider.prototype);
      Object.assign(mockEvmWallet, {
        getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
        getNetwork: jest.fn().mockReturnValue(MOCK_EVM_NETWORK),
        getBalance: jest.fn().mockResolvedValue(MOCK_ETH_BALANCE),
        getName: jest.fn().mockReturnValue(MOCK_PROVIDER_NAME),
        nativeTransfer: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
        getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
      });
    });

    it("should successfully parse valid input", () => {
      const validInput = { to: MOCK_DESTINATION };
      const result = ReturnNativeBalanceSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should fail parsing empty input", () => {
      const result = ReturnNativeBalanceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should return ETH balance minus gas fees via EvmWalletProvider", async () => {
      const expectedTransferAmount = MOCK_ETH_BALANCE - MOCK_GAS_COST;

      const response = await actionProvider.returnNativeBalance(mockEvmWallet, {
        to: MOCK_DESTINATION,
      });

      expect(mockEvmWallet.getBalance).toHaveBeenCalled();
      expect(mockEvmWallet.nativeTransfer).toHaveBeenCalledWith(
        MOCK_DESTINATION,
        expectedTransferAmount.toString(),
      );
      expect(response).toBe(
        `Returned ${formatUnits(expectedTransferAmount, 18)} ETH to ${MOCK_DESTINATION}\nTransaction hash: ${MOCK_TRANSACTION_HASH}`,
      );
    });

    it("should return the entire balance for EVM when provider is not EvmWalletProvider", async () => {
      // Plain WalletProvider mock does not extend EvmWalletProvider → falls to fallback path
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_ETH_BALANCE);
      mockWallet.nativeTransfer.mockResolvedValue(MOCK_TRANSACTION_HASH);

      const response = await actionProvider.returnNativeBalance(mockWallet, {
        to: MOCK_DESTINATION,
      });

      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(
        MOCK_DESTINATION,
        MOCK_ETH_BALANCE.toString(),
      );
      expect(response).toContain(`Returned ${formatUnits(MOCK_ETH_BALANCE, 18)} ETH`);
    });

    it("should return SOL balance minus 5000 lamports transaction fee", async () => {
      const SOL_TX_FEE = 5000n;
      const expectedTransferAmount = MOCK_SOL_BALANCE - SOL_TX_FEE;

      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      mockWallet.getBalance.mockResolvedValue(MOCK_SOL_BALANCE);
      mockWallet.nativeTransfer.mockResolvedValue(MOCK_SIGNATURE);

      const response = await actionProvider.returnNativeBalance(mockWallet, {
        to: MOCK_DESTINATION,
      });

      expect(mockWallet.getBalance).toHaveBeenCalled();
      expect(mockWallet.nativeTransfer).toHaveBeenCalledWith(
        MOCK_DESTINATION,
        expectedTransferAmount.toString(),
      );
      expect(response).toBe(
        `Returned ${formatUnits(expectedTransferAmount, 9)} SOL to ${MOCK_DESTINATION}\nSignature: ${MOCK_SIGNATURE}`,
      );
    });

    it("should return error when EVM balance is insufficient to cover gas fees", async () => {
      const tinyBalance = 1000n; // smaller than any estimated gas cost
      (mockEvmWallet.getBalance as jest.Mock).mockResolvedValue(tinyBalance);

      const response = await actionProvider.returnNativeBalance(mockEvmWallet, {
        to: MOCK_DESTINATION,
      });

      expect(response).toBe("Error: Insufficient balance to cover gas fees");
      expect(mockEvmWallet.nativeTransfer).not.toHaveBeenCalled();
    });

    it("should return error when SVM balance is insufficient to cover transaction fee", async () => {
      const tinyBalance = 100n; // smaller than 5000 lamport fee
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      mockWallet.getBalance.mockResolvedValue(tinyBalance);

      const response = await actionProvider.returnNativeBalance(mockWallet, {
        to: MOCK_DESTINATION,
      });

      expect(response).toBe("Error: Insufficient balance to cover transaction fee");
      expect(mockWallet.nativeTransfer).not.toHaveBeenCalled();
    });

    it("should prepend 0x to EVM destination address if missing", async () => {
      const expectedTransferAmount = MOCK_ETH_BALANCE - MOCK_GAS_COST;
      const destinationWithout0x = MOCK_DESTINATION.slice(2);

      await actionProvider.returnNativeBalance(mockEvmWallet, { to: destinationWithout0x });

      expect(mockEvmWallet.nativeTransfer).toHaveBeenCalledWith(
        `0x${destinationWithout0x}`,
        expectedTransferAmount.toString(),
      );
    });

    it("should handle ETH return balance errors", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_EVM_NETWORK);
      const error = new Error("Failed to execute transfer");
      mockWallet.getBalance.mockRejectedValue(error);

      const response = await actionProvider.returnNativeBalance(mockWallet, {
        to: MOCK_DESTINATION,
      });
      expect(response).toBe(`Error during transaction: ${error}`);
    });

    it("should handle SOL return balance errors", async () => {
      mockWallet.getNetwork.mockReturnValue(MOCK_SOLANA_NETWORK);
      const error = new Error("Failed to execute transfer");
      mockWallet.getBalance.mockRejectedValue(error);

      const response = await actionProvider.returnNativeBalance(mockWallet, {
        to: MOCK_DESTINATION,
      });
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
