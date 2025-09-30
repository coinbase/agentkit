import { DynamicEvmWalletProvider } from "./dynamicEvmWalletProvider";
import { createPublicClient, http } from "viem";
import { getChain } from "../network/network";
import { createDynamicWallet, createDynamicClient } from "./dynamicShared";

// Mock dynamic imports
jest.mock("@dynamic-labs-wallet/node-evm", () => ({
  DynamicEvmWalletClient: jest.fn(),
}));
jest.mock("@dynamic-labs-wallet/node", () => ({
  ThresholdSignatureScheme: {
    TWO_OF_TWO: "TWO_OF_TWO",
    TWO_OF_THREE: "TWO_OF_THREE",
    THREE_OF_FIVE: "THREE_OF_FIVE",
  },
}));

jest.mock("viem", () => ({
  createPublicClient: jest.fn(),
  http: jest.fn(),
}));
jest.mock("../network/network");
jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock("./dynamicShared", () => ({
  createDynamicWallet: jest.fn(),
  createDynamicClient: jest.fn(),
}));

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_TRANSACTION_HASH = "0xef01";
const MOCK_SIGNATURE_HASH = "0x1234";

describe("DynamicEvmWalletProvider", () => {
  const MOCK_CONFIG = {
    authToken: "test-auth-token",
    environmentId: "test-environment-id",
    baseApiUrl: "https://app.dynamicauth.com",
    baseMPCRelayApiUrl: "relay.dynamicauth.com",
    chainId: "84532",
    networkId: "base-sepolia",
    chainType: "ethereum" as const,
    thresholdSignatureScheme: "TWO_OF_TWO",
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
    signTransaction: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    exportPrivateKey: jest.fn().mockResolvedValue({ derivedPrivateKey: "0xprivate" }),
    importPrivateKey: jest.fn().mockResolvedValue({
      accountAddress: MOCK_ADDRESS,
      publicKeyHex: "0x123",
    }),
  };

  const mockPublicClient = {
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
    getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    getTransactionCount: jest.fn(),
    prepareTransactionRequest: jest.fn().mockResolvedValue({
      to: "0x123" as `0x${string}`,
      value: BigInt(1000),
      data: "0x" as `0x${string}`,
      gas: BigInt(21000),
      nonce: 1,
      maxFeePerGas: BigInt(1000000),
      maxPriorityFeePerGas: BigInt(1000000),
    }),
    sendRawTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
    waitForTransactionReceipt: jest.fn().mockResolvedValue({
      transactionHash: MOCK_TRANSACTION_HASH,
      status: "success",
    }),
    readContract: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import the mocked modules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DynamicEvmWalletClient } = (await import("@dynamic-labs-wallet/node-evm")) as any;

    // Mock DynamicEvmWalletClient
    DynamicEvmWalletClient.mockImplementation(() => mockDynamicClient);

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

    // Mock viem functions
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
    (http as jest.Mock).mockReturnValue(jest.fn());

    // Mock createDynamicClient
    (createDynamicClient as jest.Mock).mockResolvedValue(mockDynamicClient);

    // Mock createDynamicWallet
    (createDynamicWallet as jest.Mock).mockResolvedValue({
      wallet: mockWallet,
      dynamic: mockDynamicClient,
    });
  });

  describe("configureWithWallet", () => {
    it("should create a new wallet with Dynamic client", async () => {
      const _provider = await DynamicEvmWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(createDynamicWallet).toHaveBeenCalledWith(
        {
          ...MOCK_CONFIG,
        },
        "ethereum",
      );

      expect(getChain).toHaveBeenCalledWith(MOCK_CONFIG.chainId);
      expect(createPublicClient).toHaveBeenCalled();
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
      const { chainId: _chainId, ...configWithoutChainId } = MOCK_CONFIG;

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

    it("should sign a string message using Dynamic client", async () => {
      const result = await provider.signMessage("Hello, world!");
      expect(result).toBe(MOCK_SIGNATURE_HASH);
      expect(mockDynamicClient.signMessage).toHaveBeenCalledWith({
        message: "Hello, world!",
        accountAddress: MOCK_ADDRESS,
      });
    });

    it("should sign a Uint8Array message using Dynamic client", async () => {
      const messageBytes = new TextEncoder().encode("Hello, world!");
      const result = await provider.signMessage(messageBytes);
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
        accountAddress: MOCK_ADDRESS,
        networkId: "base-sepolia",
      });
    });

    it("should sign a transaction using Dynamic client", async () => {
      const mockTransaction = {
        to: "0x123" as `0x${string}`,
        value: BigInt(1000),
        data: "0x" as `0x${string}`,
      };

      const result = await provider.signTransaction(mockTransaction);
      expect(result).toBe(MOCK_SIGNATURE_HASH);

      // Should prepare transaction with viem
      expect(mockPublicClient.prepareTransactionRequest).toHaveBeenCalledWith({
        to: mockTransaction.to,
        value: mockTransaction.value,
        data: mockTransaction.data,
        account: MOCK_ADDRESS,
        chain: mockPublicClient.chain,
      });

      // Should sign with Dynamic
      expect(mockDynamicClient.signTransaction).toHaveBeenCalledWith({
        senderAddress: MOCK_ADDRESS,
        transaction: expect.objectContaining({
          to: mockTransaction.to,
          value: mockTransaction.value,
          data: mockTransaction.data,
          gas: BigInt(21000),
          nonce: 1,
        }),
      });
    });

    it("should send a transaction by signing and broadcasting", async () => {
      const mockTransaction = {
        to: "0x123" as `0x${string}`,
        value: BigInt(1000),
        data: "0x" as `0x${string}`,
      };

      const result = await provider.sendTransaction(mockTransaction);
      expect(result).toBe(MOCK_TRANSACTION_HASH);

      // Should prepare and sign transaction
      expect(mockPublicClient.prepareTransactionRequest).toHaveBeenCalled();
      expect(mockDynamicClient.signTransaction).toHaveBeenCalled();

      // Should broadcast signed transaction
      expect(mockPublicClient.sendRawTransaction).toHaveBeenCalledWith({
        serializedTransaction: MOCK_SIGNATURE_HASH,
      });
    });

    it("should get wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt(1000000000000000000));
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_ADDRESS,
      });
    });

    it("should get public client", () => {
      const publicClient = provider.getPublicClient();
      expect(publicClient).toBe(mockPublicClient);
    });

    it("should wait for transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(
        MOCK_TRANSACTION_HASH as `0x${string}`,
      );
      expect(receipt).toEqual({
        transactionHash: MOCK_TRANSACTION_HASH,
        status: "success",
      });
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: MOCK_TRANSACTION_HASH,
      });
    });

    it("should read contract", async () => {
      const mockParams = {
        address: "0x123" as `0x${string}`,
        abi: [],
        functionName: "balanceOf",
        args: [MOCK_ADDRESS],
      };

      await provider.readContract(mockParams);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith(mockParams);
    });

    it("should perform native transfer", async () => {
      const to = "0x456";
      const value = "1000000000000000000"; // 1 ETH in wei

      const txHash = await provider.nativeTransfer(to, value);
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockPublicClient.prepareTransactionRequest).toHaveBeenCalled();
      expect(mockDynamicClient.signTransaction).toHaveBeenCalled();
      expect(mockPublicClient.sendRawTransaction).toHaveBeenCalled();
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();
    });

    it("should throw error when signing raw hash", async () => {
      await expect(
        provider.sign(
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`,
        ),
      ).rejects.toThrow("Raw hash signing not implemented for Dynamic wallet provider");
    });

    it("should throw error when signing typed data", async () => {
      const typedData = {
        domain: { name: "Test" },
        types: {},
        message: {},
        primaryType: "Test",
      };

      await expect(provider.signTypedData(typedData)).rejects.toThrow(
        "Typed data signing not implemented for Dynamic wallet provider",
      );
    });
  });
});
