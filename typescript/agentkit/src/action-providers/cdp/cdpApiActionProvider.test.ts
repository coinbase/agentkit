/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdpClient } from "@coinbase/cdp-sdk";
import { WalletProvider } from "../../wallet-providers";
import { WalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { CdpApiActionProvider } from "./cdpApiActionProvider";
import { RequestFaucetFundsV2Schema, SwapSchema } from "./schemas";
import * as utils from "./utils";

// Mock the CDP SDK
jest.mock("@coinbase/cdp-sdk");
jest.mock("./utils");

describe("CDP API Action Provider", () => {
  let actionProvider: CdpApiActionProvider;
  let mockWalletProvider: jest.Mocked<WalletProvider & WalletProviderWithClient>;
  let mockCdpClient: jest.Mocked<CdpClient>;
  const mockGetTokenDetails = utils.getTokenDetails as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockAccount = {
      swap: jest.fn(),
    };

    mockCdpClient = {
      evm: {
        requestFaucet: jest.fn() as any,
        getAccount: jest.fn() as any,
        getSwapPrice: jest.fn() as any,
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
      readContract: jest.fn(),
      getName: jest.fn(),
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
    const FROM_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"; // ETH
    const TO_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48"; // USDC

    it("should throw an error for unsupported networks", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-sepolia" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      const result = await actionProvider.swap(mockWalletProvider, {
        fromToken: FROM_TOKEN,
        toToken: TO_TOKEN,
        fromAmount: "0.1",
        slippageBps: 100,
      });

      expect(JSON.parse(result).error).toContain(
        "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'.",
      );
    });

    it("should perform swap on base-mainnet", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-mainnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getName.mockReturnValue("cdp_evm_wallet"); // Not cdp_smart_wallet, so it will use getAccount
      (mockWalletProvider as any).getPaymasterUrl = jest
        .fn()
        .mockReturnValue("https://paymaster.example");

      const mockAccount = { swap: jest.fn() };
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockGetTokenDetails.mockResolvedValue({
        fromTokenDecimals: 18,
        toTokenDecimals: 6,
        fromTokenName: "ETH",
        toTokenName: "USDC",
      });
      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {},
        toAmount: "990000", // 0.99 USDC
        minToAmount: "980000",
      });
      mockAccount.swap.mockResolvedValue("0xswap789");

      const result = await actionProvider.swap(mockWalletProvider, {
        fromToken: FROM_TOKEN,
        toToken: TO_TOKEN,
        fromAmount: "0.1",
        slippageBps: 100,
      });

      expect(mockCdpClient.evm.getAccount).toHaveBeenCalledWith({
        address: "0x123456789",
      });
      expect(mockAccount.swap).toHaveBeenCalledWith(
        expect.objectContaining({
          network: "base",
          fromToken: FROM_TOKEN,
          toToken: TO_TOKEN,
          fromAmount: 100000000000000000n, // 0.1 ETH
          slippageBps: 100,
        }),
      );

      const parsedResult = JSON.parse(result);
      console.log(parsedResult);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.transactionHash).toBe("0xswap789");
    });

    it("should throw error for non-EVM networks", async () => {
      const mockNetwork = { protocolFamily: "svm", networkId: "solana-devnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);

      const result = await actionProvider.swap(mockWalletProvider, {
        fromToken: "So11111111111111111111111111111111111111112",
        toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7uee",
        fromAmount: "1",
        slippageBps: 100,
      });
      expect(JSON.parse(result).error).toContain(
        "CDP Swap API is currently only supported on EVM networks.",
      );
    });

    it("should throw error for wallet provider without client", async () => {
      const mockWalletWithoutClient = {
        getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      } as any;

      const result = await actionProvider.swap(mockWalletWithoutClient, {
        fromToken: FROM_TOKEN,
        toToken: TO_TOKEN,
        fromAmount: "0.1",
        slippageBps: 100,
      });
      expect(JSON.parse(result).error).toBe("Wallet provider is not a CDP Wallet Provider.");
    });

    it("should handle swap errors", async () => {
      const mockNetwork = { protocolFamily: "evm", networkId: "base-mainnet" };
      mockWalletProvider.getNetwork.mockReturnValue(mockNetwork as any);
      mockWalletProvider.getAddress.mockReturnValue("0x123456789");
      mockWalletProvider.getClient.mockReturnValue(mockCdpClient);
      mockWalletProvider.getName.mockReturnValue("cdp_evm_wallet"); // Not cdp_smart_wallet, so it will use getAccount
      (mockWalletProvider as any).getPaymasterUrl = jest
        .fn()
        .mockReturnValue("https://paymaster.example");
      mockGetTokenDetails.mockResolvedValue({
        fromTokenDecimals: 18,
        toTokenDecimals: 6,
        fromTokenName: "ETH",
        toTokenName: "USDC",
      });
      (mockCdpClient.evm.getSwapPrice as jest.Mock).mockResolvedValue({
        liquidityAvailable: true,
        issues: {},
        toAmount: "990000",
        minToAmount: "980000",
      });

      const mockAccount = { swap: jest.fn() };
      (mockCdpClient.evm.getAccount as jest.Mock).mockResolvedValue(mockAccount);
      mockAccount.swap.mockRejectedValue(new Error("Insufficient liquidity"));

      const result = await actionProvider.swap(mockWalletProvider, {
        fromToken: FROM_TOKEN,
        toToken: TO_TOKEN,
        fromAmount: "1000",
        slippageBps: 100,
      });
      expect(JSON.parse(result).error).toBe("Swap failed: Error: Insufficient liquidity");
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
        fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48",
        fromAmount: "0.1",
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...validInput, slippageBps: 100 });
    });

    it("should validate swap input with optional slippageBps", () => {
      const validInput = {
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9EB0cE3606eB48",
        toToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        fromAmount: "100",
        slippageBps: 50,
      };
      const result = SwapSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail validation when missing required fields", () => {
      const invalidInput = {
        fromToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        // missing toToken and fromAmount
      };
      const result = SwapSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
