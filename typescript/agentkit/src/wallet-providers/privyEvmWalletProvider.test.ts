import { PrivyEvmWalletProvider } from "./privyEvmWalletProvider";
import { Address, Hex, ReadContractParameters } from "viem";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_WALLET_ID = "test-wallet-id";
const MOCK_TRANSACTION_HASH = "0xef01";
const MOCK_SIGNATURE_HASH_1 = "0x1234";
const MOCK_SIGNATURE_HASH_2 = "0x5678";
const MOCK_SIGNATURE_HASH_3 = "0xabcd";

jest.mock("@privy-io/server-auth", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    appId: "mock-app-id",
    walletApi: {
      create: jest.fn().mockResolvedValue({
        id: "test-wallet-id",
        address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      }),
      getWallet: jest.fn().mockResolvedValue({
        id: "test-wallet-id",
        address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      }),
    },
  })),
}));

jest.mock("@privy-io/server-auth/viem", () => ({
  getWalletClient: jest.fn().mockReturnValue({
    account: {
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    },
    chain: {
      id: 1,
      name: "Ethereum",
      rpcUrls: {
        default: { http: ["https://eth.llamarpc.com"] },
      },
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
    },
    signMessage: jest.fn().mockResolvedValue("0x1234"),
    signTypedData: jest.fn().mockResolvedValue("0x5678"),
    signTransaction: jest.fn().mockResolvedValue("0xabcd"),
    sendTransaction: jest.fn().mockResolvedValue("0xef01"),
  }),
  getPublicClient: jest.fn().mockReturnValue({
    getChainId: jest.fn().mockResolvedValue(1),
    getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: "0xef01" }),
    readContract: jest.fn().mockResolvedValue("mock_result"),
    estimateFeesPerGas: jest.fn().mockResolvedValue({
      maxFeePerGas: BigInt(100000000),
      maxPriorityFeePerGas: BigInt(10000000),
    }),
    estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
  }),
  createViemAccount: jest.fn().mockResolvedValue({
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    type: "local",
    signMessage: jest.fn().mockResolvedValue("0x1234"),
    signTypedData: jest.fn().mockResolvedValue("0x5678"),
    signTransaction: jest.fn().mockResolvedValue("0xabcd"),
  }),
}));

jest.mock("../network", () => {
  const chain = {
    id: 1,
    name: "Ethereum",
    rpcUrls: {
      default: { http: ["https://eth.llamarpc.com"] },
    },
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  };

  return {
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      chainId: "1",
      networkId: "ethereum-mainnet",
    }),
    getChain: jest.fn().mockReturnValue(chain),
    CHAIN_ID_TO_NETWORK_ID: {
      "1": "ethereum-mainnet",
      "5": "ethereum-goerli",
      "11155111": "ethereum-sepolia",
    },
    NETWORK_ID_TO_CHAIN_ID: {
      "ethereum-mainnet": "1",
      "ethereum-goerli": "5",
      "ethereum-sepolia": "11155111",
    },
  };
});

jest.mock("viem", () => {
  const originalModule = jest.requireActual("viem");
  return {
    ...originalModule,
    createPublicClient: jest.fn().mockReturnValue({
      getChainId: jest.fn().mockResolvedValue(1),
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: "0xef01" }),
      readContract: jest.fn().mockResolvedValue("mock_result"),
      estimateFeesPerGas: jest.fn().mockResolvedValue({
        maxFeePerGas: BigInt(100000000),
        maxPriorityFeePerGas: BigInt(10000000),
      }),
      estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
    }),
    createWalletClient: jest.fn().mockReturnValue({
      account: {
        address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      },
      chain: {
        id: 1,
        name: "Ethereum",
        rpcUrls: {
          default: { http: ["https://eth.llamarpc.com"] },
        },
        nativeCurrency: {
          name: "Ether",
          symbol: "ETH",
          decimals: 18,
        },
      },
      signMessage: jest.fn().mockResolvedValue("0x1234"),
      signTypedData: jest.fn().mockResolvedValue("0x5678"),
      signTransaction: jest.fn().mockResolvedValue("0xabcd"),
      sendTransaction: jest.fn().mockResolvedValue("0xef01"),
    }),
    parseEther: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
  };
});

jest.mock("./privyShared", () => ({
  createPrivyWallet: jest.fn().mockResolvedValue({
    wallet: {
      id: "test-wallet-id",
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    },
    privy: {
      appId: "mock-app-id",
      walletApi: {
        create: jest.fn(),
        getWallet: jest.fn(),
      },
    },
  }),
}));

describe("PrivyEvmWalletProvider", () => {
  const MOCK_CONFIG = {
    appId: "mock-app-id",
    apiKey: "mock-api-key",
    appSecret: "mock-app-secret",
    networkId: "ethereum-mainnet",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("configureWithWallet", () => {
    it("should configure a wallet with required configuration", async () => {
      const provider = await PrivyEvmWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(provider).toBeInstanceOf(PrivyEvmWalletProvider);
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "ethereum-mainnet",
      });
    });

    it("should configure a wallet with chain ID", async () => {
      const provider = await PrivyEvmWalletProvider.configureWithWallet({
        ...MOCK_CONFIG,
        chainId: "5",
      });

      expect(provider).toBeInstanceOf(PrivyEvmWalletProvider);
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "ethereum-mainnet",
      });
    });

    it("should configure a wallet with existing wallet ID", async () => {
      const provider = await PrivyEvmWalletProvider.configureWithWallet({
        ...MOCK_CONFIG,
        walletId: "existing-wallet-id",
      });

      expect(provider).toBeInstanceOf(PrivyEvmWalletProvider);
    });
  });

  describe("wallet methods", () => {
    let provider: PrivyEvmWalletProvider;

    beforeEach(async () => {
      provider = await PrivyEvmWalletProvider.configureWithWallet(MOCK_CONFIG);
    });

    it("should get the wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "ethereum-mainnet",
      });
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("privy_evm_wallet_provider");
    });

    it("should sign a message", async () => {
      const result = await provider.signMessage("Hello, world!");
      expect(result).toBe(MOCK_SIGNATURE_HASH_1);
    });

    it("should sign typed data", async () => {
      const typedData = {
        domain: { name: "Test" },
        types: { Test: [{ name: "test", type: "string" }] },
        primaryType: "Test",
        message: { test: "test" },
      };

      const result = await provider.signTypedData(typedData);
      expect(result).toBe(MOCK_SIGNATURE_HASH_2);
    });

    it("should sign a transaction", async () => {
      const transaction = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: 1000000000000000000n,
      };

      const result = await provider.signTransaction(transaction);
      expect(result).toBe(MOCK_SIGNATURE_HASH_3);
    });

    it("should send a transaction", async () => {
      const transaction = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: 1000000000000000000n,
      };

      const result = await provider.sendTransaction(transaction);
      expect(result).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should get the wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt(1000000000000000000));
    });

    it("should wait for transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex);
      expect(receipt).toEqual({ transactionHash: MOCK_TRANSACTION_HASH });
    });

    it("should read contract data", async () => {
      const abi = [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
          stateMutability: "view",
        },
      ] as const;

      const params: ReadContractParameters = {
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS as Address],
      };

      const result = await provider.readContract(params);
      expect(result).toBe("mock_result");
    });

    it("should transfer native tokens", async () => {
      const result = await provider.nativeTransfer(
        "0x1234567890123456789012345678901234567890" as Address,
        "1.0",
      );

      expect(result).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should export wallet data", () => {
      const exportData = provider.exportWallet();

      expect(exportData).toEqual({
        walletId: MOCK_WALLET_ID,
        authorizationPrivateKey: undefined,
        chainId: "1",
        networkId: "ethereum-mainnet",
      });
    });

    it("should handle authorization key requirements properly", async () => {
      const authorizationKeyId = "test-auth-key-id";

      const mockPrivyClient = {
        walletApi: {
          create: jest.fn().mockImplementation(({ authorizationKeyIds }) => {
            if (authorizationKeyIds && authorizationKeyIds.length > 0) {
              throw new Error("Missing `privy-authorization-signature` header");
            }
            return Promise.resolve({
              id: "test-wallet-id",
              address: MOCK_ADDRESS,
            });
          }),
        },
      };

      const privyServerAuth = jest.requireMock("@privy-io/server-auth");
      const originalMockImplementation = privyServerAuth.PrivyClient.getMockImplementation();

      privyServerAuth.PrivyClient.mockImplementation(() => mockPrivyClient);

      await expect(
        PrivyEvmWalletProvider.configureWithWallet({
          appId: "test-app-id",
          appSecret: "test-app-secret",
          authorizationKeyId,
        }),
      ).rejects.toThrow(
        "authorizationPrivateKey is required when creating a new wallet with an authorizationKeyId",
      );

      privyServerAuth.PrivyClient.mockImplementation(originalMockImplementation);
    });

    it("should handle wallet creation errors", async () => {
      const mockPrivyClient = {
        walletApi: {
          create: jest.fn().mockRejectedValue(new Error("API rate limit exceeded")),
        },
      };

      const privyServerAuth = jest.requireMock("@privy-io/server-auth");
      const originalMockImplementation = privyServerAuth.PrivyClient.getMockImplementation();

      privyServerAuth.PrivyClient.mockImplementation(() => mockPrivyClient);

      const originalConsoleError = console.error;
      console.error = jest.fn();

      await expect(
        PrivyEvmWalletProvider.configureWithWallet({
          appId: "test-app-id",
          appSecret: "test-app-secret",
        }),
      ).rejects.toThrow("Failed to create wallet");

      console.error = originalConsoleError;
      privyServerAuth.PrivyClient.mockImplementation(originalMockImplementation);
    });
  });
});
