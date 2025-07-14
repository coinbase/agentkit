import { CdpClient, EvmSmartAccount, EvmServerAccount } from "@coinbase/cdp-sdk";
import { PublicClient, ReadContractParameters, TransactionRequest } from "viem";
import { Network } from "../network";
import { CdpSmartWalletProvider } from "./cdpSmartWalletProvider";

// =========================================================
// consts
// =========================================================

const mockPublicClient = {
  readContract: jest.fn(),
  getBalance: jest.fn(),
} as unknown as jest.Mocked<PublicClient>;

// =========================================================
// mocks
// =========================================================

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("../../package.json", () => ({
  version: "1.0.0",
}));

jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn(() => mockPublicClient),
    http: jest.fn(),
  };
});

jest.mock("../network", () => {
  return {
    NETWORK_ID_TO_CHAIN_ID: {
      "base-mainnet": "8453",
      "base-sepolia": "84532",
    },
    NETWORK_ID_TO_VIEM_CHAIN: {
      "base-mainnet": { id: 8453 },
      "base-sepolia": { id: 84532 },
    },
  };
});

// Mock CdpClient
jest.mock("@coinbase/cdp-sdk", () => {
  const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const MOCK_SMART_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";
  const MOCK_USER_OP_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  const mockCreateAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
    }),
  );

  const mockGetSmartAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_SMART_ADDRESS,
    }),
  );

  const mockCreateSmartAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_SMART_ADDRESS,
    }),
  );

  const mockGetOrCreateSmartAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_SMART_ADDRESS,
    }),
  );

  const mockSendUserOperation = jest
    .fn()
    .mockImplementation(async () => ({ userOpHash: MOCK_USER_OP_HASH }));

  const mockEvmClient = {
    createAccount: mockCreateAccount as jest.MockedFunction<typeof mockCreateAccount>,
    getAccount: jest.fn(),
    createSmartAccount: mockCreateSmartAccount,
    getOrCreateSmartAccount: mockGetOrCreateSmartAccount,
    getSmartAccount: mockGetSmartAccount,
    sendUserOperation: mockSendUserOperation,
  };

  return {
    CdpClient: jest.fn().mockImplementation(() => ({
      evm: mockEvmClient,
    })),
    EvmServerAccount: jest.fn().mockImplementation(() => ({
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
    })),
    EvmSmartAccount: jest.fn().mockImplementation(() => ({
      address: MOCK_SMART_ADDRESS,
    })),
  };
});

// =========================================================
// test constants
// =========================================================

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_SMART_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_NETWORK_ID = "base-sepolia";
const MOCK_USER_OP_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";
const MOCK_BALANCE = 1000000000000000000n;
const MOCK_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: MOCK_NETWORK_ID,
  chainId: "84532",
};

describe("CdpSmartWalletProvider", () => {
  let provider: CdpSmartWalletProvider;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockSmartAccount: jest.Mocked<EvmSmartAccount>;
  let mockOwnerAccount: jest.Mocked<EvmServerAccount>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCdpClient = new CdpClient({
      apiKeyId: "test-key-id",
      apiKeySecret: "test-key-secret",
      walletSecret: "test-wallet-secret",
    }) as jest.Mocked<CdpClient>;

    mockOwnerAccount = {
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
    } as unknown as jest.Mocked<EvmServerAccount>;

    mockSmartAccount = {
      address: MOCK_SMART_ADDRESS,
    } as unknown as jest.Mocked<EvmSmartAccount>;

    // Set up the mock smart account for the provider
    (
      mockCdpClient.evm.createAccount as jest.MockedFunction<typeof mockCdpClient.evm.createAccount>
    ).mockResolvedValue(mockOwnerAccount);
    (
      mockCdpClient.evm.createSmartAccount as jest.MockedFunction<
        typeof mockCdpClient.evm.createSmartAccount
      >
    ).mockResolvedValue(mockSmartAccount);

    mockPublicClient.readContract.mockResolvedValue("mock_result" as string);
    mockPublicClient.getBalance.mockResolvedValue(MOCK_BALANCE);

    provider = await CdpSmartWalletProvider.configureWithWallet({
      apiKeyId: "test-key-id",
      apiKeySecret: "test-key-secret",
      walletSecret: "test-wallet-secret",
      networkId: MOCK_NETWORK_ID,
    });
  });

  // =========================================================
  // initialization tests
  // =========================================================

  describe("initialization", () => {
    it("should initialize with API keys", async () => {
      const provider = await CdpSmartWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
        networkId: MOCK_NETWORK_ID,
      });

      expect(provider.getAddress()).toBe(MOCK_SMART_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should throw error for non-Base networks", async () => {
      await expect(
        CdpSmartWalletProvider.configureWithWallet({
          apiKeyId: "test-key-id",
          apiKeySecret: "test-key-secret",
          walletSecret: "test-wallet-secret",
          networkId: "ethereum-sepolia",
        }),
      ).rejects.toThrow("Smart wallets are only supported on Base networks");
    });

    it("should create smart account with name", async () => {
      await CdpSmartWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
        networkId: MOCK_NETWORK_ID,
        smartAccountName: "MySmartWallet",
      });

      expect(mockCdpClient.evm.getSmartAccount).toHaveBeenCalledWith({
        name: "MySmartWallet",
        owner: mockOwnerAccount,
      });
    });
  });

  // =========================================================
  // basic wallet method tests
  // =========================================================

  describe("basic wallet methods", () => {
    it("should get the smart wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_SMART_ADDRESS);
    });

    it("should get the network", () => {
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should get the name", () => {
      expect(provider.getName()).toBe("cdp_smart_wallet_provider");
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(MOCK_BALANCE);
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_SMART_ADDRESS,
      });
    });
  });

  // =========================================================
  // signing operation tests
  // =========================================================

  describe("signing operations", () => {
    it("should sign messages using owner account", async () => {
      const signature = await provider.signMessage("Hello, world!");
      expect(mockOwnerAccount.signMessage).toHaveBeenCalledWith({ message: "Hello, world!" });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign typed data using owner account", async () => {
      const typedData = {
        domain: { name: "Example" },
        types: { Test: [{ name: "test", type: "string" }] },
        message: { test: "example" },
        primaryType: "Test",
      };

      const signature = await provider.signTypedData(typedData);
      expect(mockOwnerAccount.signTypedData).toHaveBeenCalledWith(typedData);
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should throw error for direct transaction signing", async () => {
      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.signTransaction(tx)).rejects.toThrow(
        "Direct transaction signing not supported for smart wallets",
      );
    });
  });

  // =========================================================
  // user operation tests
  // =========================================================

  describe("user operations", () => {
    it("should send user operations", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const userOpHash = await provider.sendTransaction(transaction);
      expect(mockCdpClient.evm.sendUserOperation).toHaveBeenCalledWith({
        smartAccount: mockSmartAccount,
        network: "base-sepolia",
        calls: [
          {
            to: transaction.to,
            value: BigInt(transaction.value!.toString()),
            data: "0x",
          },
        ],
      });
      expect(userOpHash).toBe(MOCK_USER_OP_HASH);
    });

    it("should handle native transfers", async () => {
      const userOpHash = await provider.nativeTransfer(
        "0x1234567890123456789012345678901234567890" as `0x${string}`,
        "1000000000000000000",
      );
      expect(userOpHash).toBe(MOCK_USER_OP_HASH);
    });
  });

  // =========================================================
  // contract interaction tests
  // =========================================================

  describe("contract interactions", () => {
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

      const result = await provider.readContract({
        address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        abi,
        functionName: "balanceOf",
        args: [MOCK_SMART_ADDRESS as `0x${string}`],
      } as unknown as jest.Mocked<ReadContractParameters>);

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });
  });
});
