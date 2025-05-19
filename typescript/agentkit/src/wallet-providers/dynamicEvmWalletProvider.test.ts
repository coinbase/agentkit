import { DynamicEvmWalletProvider } from "./dynamicEvmWalletProvider";
import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";
import type { Address, Hex } from "viem";
import { createWalletClient, http } from "viem";
import { getChain } from "../network/network";
import { createDynamicWallet } from "./dynamicShared";

jest.mock("@dynamic-labs-wallet/node-evm");
jest.mock("viem");
jest.mock("../network/network");
jest.mock("./dynamicShared");

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_TRANSACTION_HASH = "0xef01";
const MOCK_SIGNATURE_HASH = "0x1234";

describe("DynamicEvmWalletProvider", () => {
  const MOCK_CONFIG = {
    authToken: "test-auth-token",
    environmentId: "test-environment-id",
    baseApiUrl: "https://app.dynamicauth.com",
    baseMPCRelayApiUrl: "https://relay.dynamicauth.com",
    chainId: "84532",
    chainType: "ethereum" as const,
    thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
  };

  const mockWallet = {
    accountAddress: MOCK_ADDRESS,
    publicKeyHex: "0x123",
  };

  const mockDynamicClient = {
    createViemPublicClient: jest.fn().mockReturnValue({
      getBalance: jest.fn(),
      getTransactionCount: jest.fn(),
    }),
    signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    exportPrivateKey: jest.fn().mockResolvedValue({ derivedPrivateKey: "0xprivate" }),
    importPrivateKey: jest.fn().mockResolvedValue({
      accountAddress: MOCK_ADDRESS,
      publicKeyHex: "0x123",
    }),
  };

  const mockWalletClient = {
    account: {
      address: MOCK_ADDRESS,
      type: "json-rpc",
    },
    chain: {
      id: 84532,
      name: "Base Goerli",
      rpcUrls: {
        default: { http: ["https://goerli.base.org"] },
      },
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
    },
    signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    signTransaction: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    sendTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DynamicEvmWalletClient
    (DynamicEvmWalletClient as jest.Mock).mockImplementation(() => mockDynamicClient);

    // Mock getChain
    (getChain as jest.Mock).mockReturnValue({
      id: 84532,
      name: "Base Goerli",
      rpcUrls: {
        default: { http: ["https://goerli.base.org"] },
      },
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
    });

    // Mock createWalletClient
    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);

    // Mock createDynamicWallet
    (createDynamicWallet as jest.Mock).mockResolvedValue({
      wallet: mockWallet,
      dynamic: mockDynamicClient,
    });
  });

  describe("configureWithWallet", () => {
    it("should create a new wallet with Dynamic client", async () => {
      const provider = await DynamicEvmWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(createDynamicWallet).toHaveBeenCalledWith({
        ...MOCK_CONFIG,
        chainType: "ethereum",
      });

      expect(mockDynamicClient.createViemPublicClient).toHaveBeenCalledWith({
        chain: expect.any(Object),
      });

      expect(getChain).toHaveBeenCalledWith(MOCK_CONFIG.chainId);
      expect(createWalletClient).toHaveBeenCalled();
    });

    it("should throw error when wallet creation fails", async () => {
      (createDynamicWallet as jest.Mock).mockRejectedValue(new Error("Failed to create wallet"));

      await expect(DynamicEvmWalletProvider.configureWithWallet(MOCK_CONFIG)).rejects.toThrow(
        "Failed to create wallet",
      );
    });

    it("should throw error when chain is not found", async () => {
      (getChain as jest.Mock).mockReturnValue(null);

      await expect(DynamicEvmWalletProvider.configureWithWallet(MOCK_CONFIG)).rejects.toThrow(
        `Chain with ID ${MOCK_CONFIG.chainId} not found`,
      );
    });

    it("should use default chain ID when not provided", async () => {
      const { chainId, ...configWithoutChainId } = MOCK_CONFIG;

      await DynamicEvmWalletProvider.configureWithWallet(configWithoutChainId);

      expect(getChain).toHaveBeenCalledWith("84532");
    });
  });

  describe("wallet methods", () => {
    let provider: DynamicEvmWalletProvider;

    beforeEach(async () => {
      provider = await DynamicEvmWalletProvider.configureWithWallet(MOCK_CONFIG);
    });

    it("should get the wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: MOCK_CONFIG.chainId,
        networkId: "base-sepolia",
      });
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("dynamic_evm_wallet_provider");
    });

    it("should sign a message using Dynamic client", async () => {
      const result = await provider.signMessage("Hello, world!");
      expect(result).toBe(MOCK_SIGNATURE_HASH);
      expect(mockDynamicClient.signMessage).toHaveBeenCalledWith({
        message: "Hello, world!",
        accountAddress: MOCK_ADDRESS,
      });
    });

    it("should export private key", async () => {
      const result = await provider.exportPrivateKey();
      expect(result).toBe("0xprivate");
      expect(mockDynamicClient.exportPrivateKey).toHaveBeenCalledWith({
        accountAddress: MOCK_ADDRESS,
      });
    });

    it("should import private key", async () => {
      const result = await provider.importPrivateKey("0xprivate");
      expect(result).toEqual({
        accountAddress: MOCK_ADDRESS,
        publicKeyHex: "0x123",
      });
      expect(mockDynamicClient.importPrivateKey).toHaveBeenCalledWith({
        privateKey: "0xprivate",
        chainName: "EVM",
        thresholdSignatureScheme: "TWO_OF_TWO",
      });
    });

    it("should export wallet information", async () => {
      const result = await provider.exportWallet();
      expect(result).toEqual({
        walletId: MOCK_ADDRESS,
        chainId: MOCK_CONFIG.chainId,
        networkId: "base-sepolia",
      });
    });
  });
}); 