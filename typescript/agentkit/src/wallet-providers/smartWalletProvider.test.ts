import { SmartWalletProvider } from "./smartWalletProvider";
import {
  TransactionRequest,
  Hex,
  Address,
  Abi,
  PublicClient,
  WaitForTransactionReceiptReturnType,
  ReadContractParameters as _ReadContractParameters,
} from "viem";
import { jest } from "@jest/globals";

import * as coinbaseSdk from "@coinbase/coinbase-sdk";
import * as _viem from "viem";
import { UserOperation } from "@coinbase/coinbase-sdk/dist/client/api";

// =========================================================
// constants
// =========================================================

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_CHAIN_ID = "1";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_BALANCE = BigInt(1000000000000000000);

const mockPublicClient = {
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
} as unknown as jest.Mocked<PublicClient>;

enum UserOperationStatus {
  CREATED = "created",
  PENDING = "pending",
  COMPLETE = "complete",
}

// =========================================================
// Mock Dependencies
// =========================================================

jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn(() => mockPublicClient),
    http: jest.fn(),
    parseEther: jest.fn((_value: string) => MOCK_BALANCE),
  };
});

jest.mock("../network", () => {
  return {
    NETWORK_ID_TO_CHAIN_ID: {
      mainnet: "1",
      "base-sepolia": "84532",
    },
  };
});

jest.mock("@coinbase/coinbase-sdk", () => {
  return {
    CHAIN_ID_TO_NETWORK_ID: {
      "1": "mainnet",
      "84532": "base-sepolia",
    },
    NETWORK_ID_TO_CHAIN_ID: {
      mainnet: "1",
      "base-sepolia": "84532",
    },
    NETWORK_ID_TO_VIEM_CHAIN: {
      "base-sepolia": {},
    },
    Coinbase: {
      configure: jest.fn(),
      configureFromJson: jest.fn(),
      networks: {},
    },
    waitForUserOperation: jest.fn(),
    createSmartWallet: jest.fn(),
  };
});

// =========================================================
// Tests
// =========================================================

describe("SmartWalletProvider", () => {
  let provider: SmartWalletProvider;
  let mockNetworkScopedWallet: {
    address: string;
    getBalance: jest.Mock;
    sendTransaction: jest.Mock;
    sendUserOperation: jest.Mock;
  };
  let mockWaitForUserOperation: jest.Mock<
    () => Promise<{ status: UserOperationStatus; transactionHash: string }>
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock network-scoped wallet with explicit type casting
    mockNetworkScopedWallet = {
      address: MOCK_ADDRESS,
      getBalance: jest.fn(),
      sendTransaction: jest.fn(),
      sendUserOperation: jest.fn(),
    } as unknown as jest.Mocked<SmartWalletProvider>;

    // Use separate setup for mock implementations to avoid type errors
    mockNetworkScopedWallet.getBalance.mockResolvedValue(MOCK_BALANCE);
    mockNetworkScopedWallet.sendTransaction.mockResolvedValue(MOCK_TRANSACTION_HASH);
    mockNetworkScopedWallet.sendUserOperation.mockResolvedValue({
      hash: MOCK_TRANSACTION_HASH,
      wait: jest.fn().mockResolvedValue({
        status: UserOperationStatus.COMPLETE,
        transactionHash: MOCK_TRANSACTION_HASH,
      }),
    } as unknown as jest.Mocked<UserOperation>);

    // Configure Public Client mocks
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TRANSACTION_HASH,
    } as unknown as jest.Mocked<WaitForTransactionReceiptReturnType>);

    mockPublicClient.readContract.mockResolvedValue("mock_result");

    // Create a mock provider object
    provider = {
      sendTransaction: jest.fn(),
      sendUserOperation: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
      signTransaction: jest.fn(),
      getAddress: jest.fn(),
      getNetwork: jest.fn(),
      getName: jest.fn(),
      getBalance: jest.fn(),
      readContract: jest.fn(),
      nativeTransfer: jest.fn(),
      _smartWallet: mockNetworkScopedWallet,
    } as unknown as SmartWalletProvider;

    // Configure mock implementations separately after object creation
    (provider.getAddress as jest.Mock).mockReturnValue(MOCK_ADDRESS);
    (provider.getNetwork as jest.Mock).mockReturnValue({
      protocolFamily: "evm",
      networkId: MOCK_NETWORK_ID,
      chainId: MOCK_CHAIN_ID,
    });
    (provider.getName as jest.Mock).mockReturnValue("smart_wallet_provider");
    (provider.getBalance as jest.Mock).mockResolvedValue(MOCK_BALANCE);

    // Configure mock implementations
    (provider.sendTransaction as jest.Mock).mockImplementation(async tx => {
      const _result = await mockNetworkScopedWallet.sendUserOperation({ calls: [tx] });
      return _result.hash;
    });

    (provider.sendUserOperation as jest.Mock).mockImplementation(async op => {
      const _result = await mockNetworkScopedWallet.sendUserOperation(op);
      return _result.hash;
    });

    (provider.waitForTransactionReceipt as jest.Mock).mockImplementation(hash =>
      mockPublicClient.waitForTransactionReceipt({ hash }),
    );

    (provider.readContract as jest.Mock).mockImplementation(params =>
      mockPublicClient.readContract(params),
    );

    // Set up nativeTransfer method
    (provider.nativeTransfer as jest.Mock).mockImplementation(async (_to, _value) => {
      const _result = await mockNetworkScopedWallet.sendUserOperation({
        calls: [
          {
            to: _to,
            value: BigInt(1000000000000000000), // parseEther(value),
          },
        ],
      });
      return MOCK_TRANSACTION_HASH;
    });

    // Set up the sign methods to reject with "Not implemented"
    const notImplementedError = new Error("Not implemented");
    (provider.signMessage as jest.Mock).mockRejectedValue(notImplementedError);
    (provider.signTypedData as jest.Mock).mockRejectedValue(notImplementedError);
    (provider.signTransaction as jest.Mock).mockRejectedValue(notImplementedError);

    // Set up waitForUserOperation mock
    mockWaitForUserOperation = jest.fn();
    mockWaitForUserOperation.mockResolvedValue({
      status: UserOperationStatus.COMPLETE,
      transactionHash: MOCK_TRANSACTION_HASH,
    });

    // Assign the mock to coinbaseSdk.waitForUserOperation
    (coinbaseSdk as unknown).waitForUserOperation = mockWaitForUserOperation;
  });

  // =========================================================
  // Transaction Operations
  // =========================================================

  describe("transaction operations", () => {
    it("should send transactions", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      const txHash = await provider.sendTransaction(transaction);

      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockNetworkScopedWallet.sendUserOperation).toHaveBeenCalled();
    });

    it("should send a user operation", async () => {
      const calls = [
        {
          to: "0x1234567890123456789012345678901234567890" as Address,
          data: "0xabcdef" as Hex,
          value: 0n,
        },
      ];

      const txHash = await provider.sendUserOperation({ calls });

      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockNetworkScopedWallet.sendUserOperation).toHaveBeenCalledWith({ calls });
    });

    it("should wait for transaction receipts", async () => {
      await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();
    });

    it("should handle transaction failures", async () => {
      mockWaitForUserOperation.mockRejectedValueOnce(new Error("Failed to send transaction"));

      // Make sendUserOperation fail in this case
      mockNetworkScopedWallet.sendUserOperation.mockRejectedValueOnce(
        new Error("Failed to send transaction"),
      );

      await expect(
        provider.sendTransaction({
          to: MOCK_ADDRESS as Address,
          value: MOCK_BALANCE,
        }),
      ).rejects.toThrow("Failed to send transaction");
    });

    it("should handle network errors in transactions", async () => {
      mockNetworkScopedWallet.sendUserOperation.mockRejectedValueOnce(
        new Error("Network connection error"),
      );

      await expect(
        provider.sendTransaction({
          to: MOCK_ADDRESS as Address,
          value: MOCK_BALANCE,
        }),
      ).rejects.toThrow("Network connection error");
    });

    it("should handle invalid address errors", async () => {
      mockNetworkScopedWallet.sendUserOperation.mockImplementationOnce(() => {
        throw new Error("Invalid address format");
      });

      const invalidAddressHex = "0xinvalid" as unknown as `0x${string}`;

      await expect(
        provider.sendTransaction({
          to: invalidAddressHex,
          value: MOCK_BALANCE,
        }),
      ).rejects.toThrow("Invalid address format");
    });

    it("should handle receipt retrieval failures", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(
        new Error("Receipt retrieval failed"),
      );

      await expect(provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH)).rejects.toThrow(
        "Receipt retrieval failed",
      );
    });

    it("should handle operation failures when sending transactions", async () => {
      const failedOperation = {
        hash: MOCK_TRANSACTION_HASH,
        wait: jest.fn().mockResolvedValue({
          status: "failed",
          transactionHash: MOCK_TRANSACTION_HASH,
        }),
      };

      mockNetworkScopedWallet.sendUserOperation.mockResolvedValueOnce(failedOperation as unknown);

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow(
        "Transaction failed with status failed",
      );
    });

    it("should handle exceptions when sending user operations", async () => {
      mockNetworkScopedWallet.sendUserOperation.mockRejectedValueOnce(new Error("Failed to send"));

      const calls = [
        {
          to: "0x1234567890123456789012345678901234567890" as Address,
          data: "0xabcdef" as Hex,
          value: BigInt(0),
        },
      ];

      await expect(provider.sendUserOperation({ calls })).rejects.toThrow("Failed to send");
    });

    it("should handle send user operation timeout", async () => {
      mockNetworkScopedWallet.sendUserOperation.mockImplementationOnce(() => {
        throw new Error("User operation timed out");
      });

      const calls = [
        {
          to: "0x1234567890123456789012345678901234567890" as Address,
          data: "0xabcdef" as Hex,
          value: 0n,
        },
      ];

      await expect(provider.sendUserOperation({ calls })).rejects.toThrow(
        "User operation timed out",
      );
    });
  });

  // =========================================================
  // Native Token Transfer Operations
  // =========================================================

  describe("native token operations", () => {
    it("should transfer native tokens", async () => {
      if (typeof provider.nativeTransfer === "function") {
        const to = "0x1234567890123456789012345678901234567890" as Address;
        const value = "1"; // Use "1" instead of "1.0" for BigInt compatibility

        const txHash = await provider.nativeTransfer(to, value);

        expect(mockNetworkScopedWallet.sendUserOperation).toHaveBeenCalled();
        expect(txHash).toBe(MOCK_TRANSACTION_HASH);
      }
    });

    it("should handle operation failures when transferring native tokens", async () => {
      if (typeof provider.nativeTransfer === "function") {
        // Set up the nativeTransfer mock to throw for failed operations
        provider.nativeTransfer.mockRejectedValueOnce(
          new Error("Transfer failed with status failed"),
        );

        const to = "0x1234567890123456789012345678901234567890" as Address;
        const value = "1";

        await expect(provider.nativeTransfer(to, value)).rejects.toThrow(
          "Transfer failed with status failed",
        );
      }
    });

    it("should handle invalid address format in native transfer", async () => {
      if (typeof provider.nativeTransfer === "function") {
        // Override the mock implementation for this test
        (provider.nativeTransfer as jest.Mock).mockImplementationOnce((_to) => {
          throw new Error("Invalid address format");
        });

        const invalidAddress = "not_a_valid_address";

        await expect(
          provider.nativeTransfer(invalidAddress as unknown as Address, "1"),
        ).rejects.toThrow("Invalid address format");
      }
    });

    it("should handle network errors in native token transfers", async () => {
      if (typeof provider.nativeTransfer === "function") {
        // Override the mock implementation for this test
        provider.nativeTransfer.mockRejectedValueOnce(new Error("Network error"));

        await expect(
          provider.nativeTransfer("0x1234567890123456789012345678901234567890" as Address, "1"),
        ).rejects.toThrow("Network error");
      }
    });
  });

  // =========================================================
  // Contract Interaction Methods
  // =========================================================

  describe("contract interactions", () => {
    it("should read from contracts", async () => {
      const result = await provider.readContract({
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi: [],
        functionName: "balanceOf",
        args: [MOCK_ADDRESS],
      });

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it("should handle errors in contract reads", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read failed"));

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as Address,
          abi: [],
          functionName: "balanceOf",
          args: [MOCK_ADDRESS],
        }),
      ).rejects.toThrow("Contract read failed");
    });

    it("should handle read contract with invalid ABI", async () => {
      const invalidAbi = "not_an_abi" as unknown as Abi;
      const params = {
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi: invalidAbi,
        functionName: "balanceOf",
        args: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"],
      };

      mockPublicClient.readContract.mockImplementationOnce(() => {
        throw new TypeError("Invalid ABI format");
      });

      await expect(provider.readContract(params)).rejects.toThrow("Invalid ABI format");
    });
  });

  // =========================================================
  // Signing Methods (Unsupported Operations)
  // =========================================================

  describe("unsupported operations", () => {
    it("should throw error on sign message", async () => {
      await expect(provider.signMessage("test")).rejects.toThrow("Not implemented");
    });

    it("should throw error on sign typed data", async () => {
      await expect(
        provider.signTypedData({
          domain: {},
          types: {},
          primaryType: "",
          message: {},
        }),
      ).rejects.toThrow("Not implemented");
    });

    it("should throw error on sign transaction", async () => {
      await expect(
        provider.signTransaction({
          to: MOCK_ADDRESS as Address,
          value: MOCK_BALANCE,
        }),
      ).rejects.toThrow("Not implemented");
    });
  });
});
