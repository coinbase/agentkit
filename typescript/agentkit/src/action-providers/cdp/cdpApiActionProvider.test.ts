/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient } from "@coinbase/cdp-sdk";
import { WalletProvider } from "../../wallet-providers";
import { WalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { CdpApiActionProvider } from "./cdpApiActionProvider";
import { RequestFaucetFundsV2Schema, SwapSchema } from "./schemas";

// Mock the CDP SDK
jest.mock("@coinbase/cdp-sdk");

describe("CDP API Action Provider", () => {
  let actionProvider: CdpApiActionProvider;
  let mockWalletProvider: jest.Mocked<WalletProvider & WalletProviderWithClient>;
  let mockCdpClient: jest.Mocked<CdpClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockAccount = {
      swap: jest.fn(),
    };

    mockCdpClient = {
      evm: {
        requestFaucet: jest.fn() as any,
        getAccount: jest.fn() as any,
      },
      solana: {
        requestFaucet: jest.fn() as any,
      },
    } as any;

    // Set up default mock behavior
    (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);

    mockWalletProvider = {
      getNetwork: jest.fn(),
      getAddress: jest.fn(),
      getClient: jest.fn(),
    } as any;

    actionProvider = new CdpApiActionProvider();
  });

  describe("initialization", () => {
    it("should initialize with correct provider name", () => {
      expect(actionProvider.name).toBe("cdp_api");
    });

    it("should support all networks", () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      expect(actionProvider.supportsNetwork(mockNetwork as any)).toBe(true);
    });
  });

  describe("faucet", () => {
    it("should request faucet funds on base-sepolia", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      (mockCdpClient.evm.requestFaucet as jest.Mock).mockResolvedValue({
        transactionHash: "0xabcdef123456",
      });

      const result = await actionProvider.faucet(mockWalletProvider, { assetId: "eth" });

      expect(mockCdpClient.evm.requestFaucet).toHaveBeenCalledWith({
        address: "0x123456789",
        token: "eth",
        network: "base-sepolia",
      });
      expect(result).toContain("Received eth from the faucet");
      expect(result).toContain("0xabcdef123456");
    });

    it("should request faucet funds on solana-devnet", async () => {
      const mockNetwork = { protocolFamily: "svm", networkId: "solana-devnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("address123");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      (mockCdpClient.solana.requestFaucet as jest.Mock).mockResolvedValue({
        signature: "signature123",
      });

      const result = await actionProvider.faucet(mockWalletProvider, { assetId: "sol" });

      expect(mockCdpClient.solana.requestFaucet).toHaveBeenCalledWith({
        address: "address123",
        token: "sol",
      });
      expect(result).toContain("Received sol from the faucet");
      expect(result).toContain("signature123");
    });

    it("should throw error for unsupported EVM network", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "ethereum-mainnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      await expect(actionProvider.faucet(mockWalletProvider, { assetId: "eth" })).rejects.toThrow(
        "Faucet is only supported on 'base-sepolia' or 'ethereum-sepolia' evm networks",
      );
    });

    it("should throw error for unsupported Solana network", async () => {
      const mockNetwork = { protocolFamily: "svm", networkId: "solana-mainnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      await expect(actionProvider.faucet(mockWalletProvider, { assetId: "sol" })).rejects.toThrow(
        "Faucet is only supported on 'solana-devnet' solana networks",
      );
    });

    it("should throw error for wallet provider without client", async () => {
      const mockWalletWithoutClient = {
        getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia" }),
      } as any;

      await expect(
        actionProvider.faucet(mockWalletWithoutClient, { assetId: "eth" }),
      ).rejects.toThrow("Wallet provider is not a CDP Wallet Provider");
    });
  });

  describe("swap", () => {
    it("should perform swap on base-sepolia", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      const mockAccount = { swap: jest.fn() };
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockAccount.swap.mockResolvedValue({
        transactionHash: "0xswap123456",
      });

      const result = await actionProvider.swap(mockWalletProvider, {
        fromAssetId: "eth",
        toAssetId: "usdc",
        amount: "0.1",
      });

      expect(mockCdpClient.evm.getAccount).toHaveBeenCalledWith({
        address: "0x123456789",
      });
      expect(mockAccount.swap).toHaveBeenCalledWith({
        network: "base-sepolia",
        from: "eth",
        to: "usdc",
        amount: "0.1",
        slippageBps: 100,
      });
      expect(result).toContain("Successfully swapped 0.1 ETH to USDC");
      expect(result).toContain("0xswap123456");
    });

    it("should perform swap on base-mainnet", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-mainnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      const mockAccount = { swap: jest.fn() };
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockAccount.swap.mockResolvedValue({
        transactionHash: "0xswap789",
      });

      const result = await actionProvider.swap(mockWalletProvider, {
        fromAssetId: "usdc",
        toAssetId: "eth",
        amount: "100",
      });

      expect(mockAccount.swap).toHaveBeenCalledWith({
        network: "base", // Should convert base-mainnet to base
        from: "usdc",
        to: "eth",
        amount: "100",
        slippageBps: 100,
      });
      expect(result).toContain("Successfully swapped 100 USDC to ETH");
    });

    it("should throw error for non-EVM networks", async () => {
      const mockNetwork = { protocolFamily: "svm", networkId: "solana-devnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      await expect(
        actionProvider.swap(mockWalletProvider, {
          fromAssetId: "sol",
          toAssetId: "usdc",
          amount: "1",
        }),
      ).rejects.toThrow("Swap is currently only supported on EVM networks");
    });

    it("should throw error for wallet provider without client", async () => {
      const mockWalletWithoutClient = {
        getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia" }),
      } as any;

      await expect(
        actionProvider.swap(mockWalletWithoutClient, {
          fromAssetId: "eth",
          toAssetId: "usdc",
          amount: "0.1",
        }),
      ).rejects.toThrow("Wallet provider is not a CDP Wallet Provider");
    });

    it("should handle swap errors", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      const mockAccount = { swap: jest.fn() };
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockAccount.swap.mockRejectedValue(new Error("Insufficient liquidity"));

      await expect(
        actionProvider.swap(mockWalletProvider, {
          fromAssetId: "eth",
          toAssetId: "usdc",
          amount: "1000",
        }),
      ).rejects.toThrow("Swap failed: Error: Insufficient liquidity");
    });
  });

  describe("RequestFaucetFundsV2Schema", () => {
    it("should validate correct input", () => {
      const validInput = { assetId: "eth" };
      const result = RequestFaucetFundsV2Schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should allow missing assetId", () => {
      const validInput = {};
      const result = RequestFaucetFundsV2Schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("SwapSchema", () => {
    it("should validate correct swap input", () => {
      const validInput = {
        fromAssetId: "eth",
        toAssetId: "usdc",
        amount: "0.1",
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should validate swap input with network", () => {
      const validInput = {
        fromAssetId: "usdc",
        toAssetId: "eth",
        amount: "100",
        network: "base-sepolia",
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail validation when missing required fields", () => {
      const invalidInput = {
        fromAssetId: "eth",
        // missing toAssetId and amount
      };
      const result = SwapSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
