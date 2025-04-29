import { ZeroDevWalletProvider } from "./zeroDevWalletProvider";
import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import {
  PublicClient,
  TransactionRequest,
  ReadContractParameters,
  TransactionReceipt,
  Address,
  zeroAddress,
  Hex,
  Account,
} from "viem";
import { createKernelAccount, KernelSmartAccountImplementation } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createIntentClient,
  type SendUserIntentResult,
  type IntentExecutionReceipt,
  type GetCABParameters,
} from "@zerodev/intent";
import { SmartAccount } from "viem/account-abstraction";

// =========================================================
// Consts
// =========================================================

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_PROJECT_ID = "project-1234";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b";
const MOCK_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: MOCK_NETWORK_ID,
  chainId: "1",
};

const mockPublicClient = {
  readContract: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  getBalance: jest.fn(),
} as unknown as jest.Mocked<PublicClient>;

// =========================================================
// Mocks
// =========================================================

// Mock Viem
jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn(() => mockPublicClient),
    http: jest.fn(),
    zeroAddress: "0x0000000000000000000000000000000000000000",
    toAccount: jest.fn(),
  };
});

// Mock ZeroDev SDK
jest.mock("@zerodev/sdk", () => ({
  createKernelAccount: jest.fn(),
  KERNEL_V3_2: "v3.2",
  getEntryPoint: jest.fn().mockReturnValue("0xENTRYPOINT"),
}));

// Mock ECDSA Validator
jest.mock("@zerodev/ecdsa-validator", () => ({
  signerToEcdsaValidator: jest.fn(),
}));

// Mock Intent
jest.mock("@zerodev/intent", () => ({
  createIntentClient: jest.fn(),
  installIntentExecutor: jest.fn(),
  INTENT_V0_3: "v0.3",
}));

jest.mock("../network", () => ({
  NETWORK_ID_TO_VIEM_CHAIN: {
    mainnet: { id: 1, name: "Ethereum" },
    sepolia: { id: 11155111, name: "Sepolia" },
  },
}));

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// =========================================================
// Mock Implementations
// =========================================================

const mockKernelAccount = {
  address: MOCK_ADDRESS,
  signMessage: jest.fn(),
  signTypedData: jest.fn(),
} as unknown as jest.Mocked<SmartAccount<KernelSmartAccountImplementation>>;

const mockIntentClient = {
  sendUserIntent: jest.fn(),
  waitForUserIntentExecutionReceipt: jest.fn(),
} as unknown as jest.Mocked<ReturnType<typeof createIntentClient>>;

const mockEvmWalletProvider = {
  getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
  signMessage: jest.fn(),
  signTransaction: jest.fn(),
  signTypedData: jest.fn(),
  getNetwork: jest.fn().mockReturnValue(MOCK_NETWORK),
  toSigner: jest.fn().mockReturnValue({
    address: MOCK_ADDRESS,
    signMessage: jest.fn(),
    signTransaction: jest.fn(),
    signTypedData: jest.fn(),
  } as unknown as Account),
} as unknown as jest.Mocked<EvmWalletProvider>;

// =========================================================
// Test Suite
// =========================================================

describe("ZeroDevWalletProvider", () => {
  let provider: ZeroDevWalletProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Configure mock implementations
    (createKernelAccount as jest.Mock).mockResolvedValue(mockKernelAccount);
    (createIntentClient as jest.Mock).mockResolvedValue(mockIntentClient);
    (signerToEcdsaValidator as jest.Mock).mockResolvedValue({ validator: "mock-validator" });

    mockPublicClient.readContract.mockResolvedValue("mock_result");
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TRANSACTION_HASH,
    } as unknown as TransactionReceipt);
    mockPublicClient.getBalance.mockResolvedValue(BigInt(1000000000000000000));

    mockKernelAccount.signMessage.mockResolvedValue(MOCK_SIGNATURE as `0x${string}`);
    mockKernelAccount.signTypedData.mockResolvedValue(MOCK_SIGNATURE as `0x${string}`);

    // Mock Intent Client behavior
    mockIntentClient.sendUserIntent.mockResolvedValue({
      outputUiHash: { uiHash: "0xmockUiHash" as Hex },
      inputsUiHash: { uiHash: "0xmockUiHash" as Hex },
    } as unknown as SendUserIntentResult);
    mockIntentClient.waitForUserIntentExecutionReceipt.mockResolvedValue({
      intentHash: "0xmockIntentHash" as `0x${string}`,
      sender: MOCK_ADDRESS as `0x${string}`,
      relayer: MOCK_ADDRESS as `0x${string}`,
      executionChainId: "0x1" as `0x${string}`,
      logs: [],
      receipt: { transactionHash: MOCK_TRANSACTION_HASH } as unknown as TransactionReceipt,
    });

    // Create provider instance
    provider = await ZeroDevWalletProvider.configureWithWallet({
      signer: mockEvmWalletProvider.toSigner(),
      projectId: MOCK_PROJECT_ID,
      networkId: MOCK_NETWORK_ID,
      entryPointVersion: "0.7",
    });
  });

  // =========================================================
  // Initialization Tests
  // =========================================================

  describe("initialization", () => {
    it("should initialize with a signer", async () => {
      expect(provider).toBeInstanceOf(ZeroDevWalletProvider);
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
      expect(createKernelAccount).toHaveBeenCalled();
      expect(createIntentClient).toHaveBeenCalled();
    });

    it("should throw error when signer is not provided", async () => {
      await expect(
        ZeroDevWalletProvider.configureWithWallet({
          signer: undefined as unknown as Account,
          projectId: MOCK_PROJECT_ID,
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("Signer is required");
    });

    it("should throw error when project ID is not provided", async () => {
      await expect(
        ZeroDevWalletProvider.configureWithWallet({
          signer: mockEvmWalletProvider.toSigner(),
          projectId: "",
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("ZeroDev project ID is required");
    });

    it("should initialize with a specific address if provided", async () => {
      const customAddress = "0xCustomAddress";
      await ZeroDevWalletProvider.configureWithWallet({
        signer: mockEvmWalletProvider.toSigner(),
        projectId: MOCK_PROJECT_ID,
        networkId: MOCK_NETWORK_ID,
        address: customAddress,
      });

      expect(createKernelAccount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          address: customAddress as `0x${string}`,
        }),
      );
    });
  });

  // =========================================================
  // Basic Wallet Methods Tests
  // =========================================================

  describe("basic wallet methods", () => {
    it("should get the address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network", () => {
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should get the name", () => {
      expect(provider.getName()).toBe("zerodev_wallet_provider");
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt(1000000000000000000));
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_ADDRESS as `0x${string}`,
      });
    });

    it("should get the kernel account", () => {
      expect(provider.getKernelAccount()).toBe(mockKernelAccount);
    });

    it("should get the intent client", () => {
      expect(provider.getIntentClient()).toBe(mockIntentClient);
    });
  });

  // =========================================================
  // Signing Operations Tests
  // =========================================================

  describe("signing operations", () => {
    it("should sign messages", async () => {
      const message = "Hello, world!";
      const signature = await provider.signMessage(message);

      expect(mockKernelAccount.signMessage).toHaveBeenCalledWith({
        message: message,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign Uint8Array messages", async () => {
      const messageBytes = new TextEncoder().encode("Hello, world!");
      const signature = await provider.signMessage(messageBytes);

      expect(mockKernelAccount.signMessage).toHaveBeenCalledWith({
        message: "Hello, world!",
      });
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

      expect(mockKernelAccount.signTypedData).toHaveBeenCalledWith(typedData);
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should throw error when signing transactions directly", async () => {
      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.signTransaction(tx)).rejects.toThrow(
        "signTransaction is not supported for ZeroDev Wallet Provider",
      );
    });
  });

  // =========================================================
  // Transaction Operations Tests
  // =========================================================

  describe("transaction operations", () => {
    it("should send native token transfer transactions", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = BigInt(1000000000000000000);

      const transaction: TransactionRequest = {
        to,
        value,
        data: "0x",
      };

      const txHash = await provider.sendTransaction(transaction);

      expect(mockIntentClient.sendUserIntent).toHaveBeenCalledWith({
        calls: [
          {
            to,
            value,
            data: "0x",
          },
        ],
        outputTokens: [
          {
            address: zeroAddress,
            chainId: 1,
            amount: value,
          },
        ],
      });

      expect(mockIntentClient.waitForUserIntentExecutionReceipt).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should send contract interaction transactions", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const data = "0xabcdef" as `0x${string}`;

      const transaction: TransactionRequest = {
        to,
        data,
      };

      const txHash = await provider.sendTransaction(transaction);

      expect(mockIntentClient.sendUserIntent).toHaveBeenCalledWith({
        calls: [
          {
            to,
            value: BigInt(0),
            data,
          },
        ],
        chainId: 1,
      });

      expect(mockIntentClient.waitForUserIntentExecutionReceipt).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle native transfers using nativeTransfer method", async () => {
      const to = "0x1234567890123456789012345678901234567890";
      const value = "1.0";

      const valueInWei = BigInt(parseFloat(value) * 10 ** 18);

      const txHash = await provider.nativeTransfer(to, value);

      expect(mockIntentClient.sendUserIntent).toHaveBeenCalledWith({
        calls: [
          {
            to: to as Address,
            value: valueInWei,
            data: "0x",
          },
        ],
        outputTokens: [
          {
            address: zeroAddress,
            chainId: 1,
            amount: valueInWei,
          },
        ],
      });

      expect(mockIntentClient.waitForUserIntentExecutionReceipt).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should wait for transaction receipt", async () => {
      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

      await provider.waitForTransactionReceipt(hash);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash });
    });

    it("should handle transaction failures", async () => {
      mockIntentClient.sendUserIntent.mockRejectedValueOnce(new Error("Transaction failed"));

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Transaction failed");
    });

    it("should handle receipt waiting failures", async () => {
      mockIntentClient.waitForUserIntentExecutionReceipt.mockRejectedValueOnce(
        new Error("Receipt waiting failed"),
      );

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Receipt waiting failed");
    });

    it("should handle missing transaction hash in receipt", async () => {
      mockIntentClient.waitForUserIntentExecutionReceipt.mockResolvedValueOnce({
        receipt: {} as unknown as TransactionReceipt,
      } as unknown as IntentExecutionReceipt);

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const txHash = await provider.sendTransaction(transaction);

      expect(txHash).toBe("0x");
    });
  });

  // =========================================================
  // Contract Interaction Tests
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
      } as unknown as ReadContractParameters);

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it("should handle contract read failures", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read failed"));

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
        } as unknown as ReadContractParameters),
      ).rejects.toThrow("Contract read failed");
    });
  });

  // =========================================================
  // Chain Abstracted Balance Tests
  // =========================================================

  describe("chain abstracted balance", () => {
    it("should get chain abstracted balance", async () => {
      const mockCABResult = {
        balance: BigInt(1000000000000000000),
        tokenAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      };

      mockIntentClient.getCAB = jest.fn().mockResolvedValue(mockCABResult);

      const options: GetCABParameters = {
        tokenTickers: ["USDC"],
        networks: [1],
      };

      const result = await provider.getCAB(options);

      expect(mockIntentClient.getCAB).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockCABResult);
    });

    it("should handle getCAB failures", async () => {
      mockIntentClient.getCAB = jest.fn().mockRejectedValue(new Error("CAB check failed"));

      const options: GetCABParameters = {
        tokenTickers: ["USDC"],
        networks: [1234],
      };

      await expect(provider.getCAB(options)).rejects.toThrow("CAB check failed");
    });
  });

  // =========================================================
  // Error Handling Tests
  // =========================================================

  describe("error handling", () => {
    it("should handle intent client initialization failures", async () => {
      (createIntentClient as jest.Mock).mockRejectedValueOnce(
        new Error("Intent client initialization failed"),
      );

      await expect(
        ZeroDevWalletProvider.configureWithWallet({
          signer: mockEvmWalletProvider.toSigner(),
          projectId: MOCK_PROJECT_ID,
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("Intent client initialization failed");
    });

    it("should handle kernel account initialization failures", async () => {
      (createKernelAccount as jest.Mock).mockRejectedValueOnce(
        new Error("Kernel account initialization failed"),
      );

      await expect(
        ZeroDevWalletProvider.configureWithWallet({
          signer: mockEvmWalletProvider.toSigner(),
          projectId: MOCK_PROJECT_ID,
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("Kernel account initialization failed");
    });

    it("should handle balance check failures", async () => {
      mockPublicClient.getBalance.mockRejectedValueOnce(new Error("Balance check failed"));

      await expect(provider.getBalance()).rejects.toThrow("Balance check failed");
    });
  });
});
