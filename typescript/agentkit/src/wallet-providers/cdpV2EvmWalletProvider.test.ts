import { CdpClient, EvmServerAccount } from "@coinbase/cdp-sdk";
import {
  Abi,
  EstimateFeesPerGasReturnType,
  PublicClient,
  ReadContractParameters,
  TransactionReceipt,
  TransactionRequest,
  createWalletClient,
} from "viem";
import { Network } from "../network";
import { CdpV2EvmWalletProvider } from "./cdpV2EvmWalletProvider";

// =========================================================
// consts
// =========================================================

const mockPublicClient = {
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  getTransactionCount: jest.fn(),
  estimateFeesPerGas: jest.fn(),
  estimateGas: jest.fn(),
  getBalance: jest.fn(),
} as unknown as jest.Mocked<PublicClient>;

const mockWalletClient = {
  sendTransaction: jest.fn(),
} as unknown as jest.Mocked<ReturnType<typeof createWalletClient>>;

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
    createWalletClient: jest.fn(() => mockWalletClient),
    http: jest.fn(),
    serializeTransaction: jest.fn((_tx: string) => "0xserialized"),
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
  const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";

  const mockCreateAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTransaction: jest.fn().mockResolvedValue({ signature: MOCK_SIGNATURE }),
    }),
  );

  const mockSignTransaction = jest
    .fn()
    .mockImplementation(async () => ({ signature: MOCK_SIGNATURE }));
  const mockSendTransaction = jest
    .fn()
    .mockImplementation(async () => ({ transactionHash: MOCK_TRANSACTION_HASH }));

  const mockEvmClient = {
    createAccount: mockCreateAccount as jest.MockedFunction<typeof mockCreateAccount>,
    getAccount: jest.fn(),
    signTransaction: mockSignTransaction,
    sendTransaction: mockSendTransaction,
  };

  return {
    CdpClient: jest.fn().mockImplementation(() => ({
      evm: mockEvmClient,
    })),
    EvmServerAccount: jest.fn().mockImplementation(() => ({
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTransaction: jest.fn().mockResolvedValue({ signature: MOCK_SIGNATURE }),
    })),
  };
});

// =========================================================
// test constants
// =========================================================

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "base-mainnet";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";
const MOCK_BALANCE = 1000000000000000000n;
const MOCK_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: MOCK_NETWORK_ID,
  chainId: "8453",
};
const MOCK_TRANSACTION_RECEIPT = {
  transactionHash: MOCK_TRANSACTION_HASH,
} as unknown as TransactionReceipt;

describe("CdpV2EvmWalletProvider", () => {
  let provider: CdpV2EvmWalletProvider;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockServerAccount: jest.Mocked<EvmServerAccount>;
  let mockSignTransaction: jest.Mock;
  let mockSendTransaction: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSignTransaction = jest.fn().mockImplementation(async () => ({ signature: MOCK_SIGNATURE }));
    mockSendTransaction = jest
      .fn()
      .mockImplementation(async () => ({ transactionHash: MOCK_TRANSACTION_HASH }));

    mockCdpClient = new CdpClient({
      apiKeyId: "test-key-id",
      apiKeySecret: "test-key-secret",
      walletSecret: "test-wallet-secret",
    }) as jest.Mocked<CdpClient>;

    mockServerAccount = {
      address: MOCK_ADDRESS,
      signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
    } as unknown as jest.Mocked<EvmServerAccount>;

    // Set up the mock server account for the provider
    (
      mockCdpClient.evm.createAccount as jest.MockedFunction<typeof mockCdpClient.evm.createAccount>
    ).mockResolvedValue(mockServerAccount);
    mockCdpClient.evm.signTransaction = mockSignTransaction;
    mockCdpClient.evm.sendTransaction = mockSendTransaction;

    mockPublicClient.waitForTransactionReceipt.mockResolvedValue(MOCK_TRANSACTION_RECEIPT);
    mockPublicClient.readContract.mockResolvedValue("mock_result" as string);
    mockPublicClient.getTransactionCount.mockResolvedValue(1);
    mockPublicClient.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: BigInt(100000000),
      maxPriorityFeePerGas: BigInt(10000000),
    } as unknown as jest.Mocked<EstimateFeesPerGasReturnType>);
    mockPublicClient.estimateGas.mockResolvedValue(BigInt(21000));
    mockPublicClient.getBalance.mockResolvedValue(MOCK_BALANCE);

    mockWalletClient.sendTransaction.mockResolvedValue(MOCK_TRANSACTION_HASH);

    provider = await CdpV2EvmWalletProvider.configureWithWallet({
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
      const provider = await CdpV2EvmWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
        networkId: MOCK_NETWORK_ID,
      });

      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should default to base-sepolia if network not provided", async () => {
      const provider = await CdpV2EvmWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
      });

      expect(provider.getNetwork().networkId).toBe("base-sepolia");
    });

    it("should handle initialization failures gracefully", async () => {
      // Create a new mock client for this test
      const mockCreateAccount = jest.fn().mockRejectedValue(new Error("Failed to create account"));
      const mockEvmClient = {
        createAccount: mockCreateAccount,
        getAccount: jest.fn(),
        signTransaction: jest.fn(),
      };

      // Override the mock for this test
      const mockCdpClient = new CdpClient({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
      }) as jest.Mocked<CdpClient>;
      mockCdpClient.evm = mockEvmClient as unknown as typeof mockCdpClient.evm;

      // Override the CdpClient constructor mock
      (CdpClient as jest.MockedClass<typeof CdpClient>).mockImplementation(() => mockCdpClient);

      await expect(
        CdpV2EvmWalletProvider.configureWithWallet({
          apiKeyId: "test-key-id",
          apiKeySecret: "test-key-secret",
          walletSecret: "test-wallet-secret",
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("Failed to create account");
    });
  });

  // =========================================================
  // basic wallet method tests
  // =========================================================

  describe("basic wallet methods", () => {
    it("should get the address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network", () => {
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should get the name", () => {
      expect(provider.getName()).toBe("cdp_v2_wallet_provider");
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(MOCK_BALANCE);
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_ADDRESS,
      });
    });

    it("should handle connection errors during balance check", async () => {
      mockPublicClient.getBalance.mockRejectedValueOnce(new Error("Network connection error"));

      await expect(provider.getBalance()).rejects.toThrow("Network connection error");
    });
  });

  // =========================================================
  // signing operation tests
  // =========================================================

  describe("signing operations", () => {
    it("should sign messages", async () => {
      const signature = await provider.signMessage("Hello, world!");
      expect(mockServerAccount.signMessage).toHaveBeenCalledWith({ message: "Hello, world!" });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign typed data", async () => {
      const typedData = {
        domain: { name: "Example" },
        types: { Test: [{ name: "test", type: "string" }] },
        message: { test: "example" },
        primaryType: "Test",
      };

      const signature = await provider.signTypedData(typedData);
      expect(mockServerAccount.signTypedData).toHaveBeenCalledWith(typedData);
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign transactions", async () => {
      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const signature = await provider.signTransaction(tx);
      expect(mockCdpClient.evm.signTransaction).toHaveBeenCalledWith({
        address: MOCK_ADDRESS,
        transaction: expect.any(String),
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should handle signing failures", async () => {
      // Create a failing mock for this test
      const mockFailingSignTransaction = jest.fn().mockRejectedValue(new Error("Signing failed"));
      mockCdpClient.evm.signTransaction = mockFailingSignTransaction;

      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.signTransaction(tx)).rejects.toThrow("Signing failed");

      // Restore the original mock
      mockCdpClient.evm.signTransaction = mockSignTransaction;
    });
  });

  // =========================================================
  // transaction operation tests
  // =========================================================

  describe("transaction operations", () => {
    it("should send transactions", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const txHash = await provider.sendTransaction(transaction);
      expect(mockSendTransaction).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle transaction failures during send", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("Transaction signing failed"));

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow(
        "Transaction signing failed",
      );
    });

    it("should handle receipt timeout errors", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error("Timed out"));

      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

      await expect(provider.waitForTransactionReceipt(hash)).rejects.toThrow("Timed out");
    });

    it("should handle transaction with invalid address", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("Invalid address format"));

      const invalidAddress = "not_a_valid_address";
      const value = "1000000000000000000"; // 1 ETH in wei

      await expect(
        provider.nativeTransfer(invalidAddress as unknown as `0x${string}`, value),
      ).rejects.toThrow("Invalid address format");
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
        args: [MOCK_ADDRESS as `0x${string}`],
      } as unknown as jest.Mocked<ReadContractParameters>);

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it("should handle network errors during contract reads", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read error"));

      const abi = [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
          stateMutability: "view",
        },
      ] as const;

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          abi,
          functionName: "balanceOf",
          args: [MOCK_ADDRESS as `0x${string}`],
        } as unknown as jest.Mocked<ReadContractParameters>),
      ).rejects.toThrow("Contract read error");
    });

    it("should handle invalid ABI format in contract reads", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new TypeError("Invalid ABI format"));

      const invalidAbi = "not_a_valid_abi" as unknown as Abi;

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          abi: invalidAbi,
          functionName: "balanceOf",
          args: [MOCK_ADDRESS as `0x${string}`],
        } as unknown as jest.Mocked<ReadContractParameters>),
      ).rejects.toThrow("Invalid ABI format");
    });
  });
});
