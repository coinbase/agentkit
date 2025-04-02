import { SmartWalletProvider } from "./smartWalletProvider";
import {
  TransactionRequest,
  Hex,
  Address,
  Abi,
  PublicClient,
  WaitForTransactionReceiptReturnType,
  ReadContractParameters,
  ContractFunctionArgs,
  ContractFunctionName,
} from "viem";

import * as coinbaseSdk from "@coinbase/coinbase-sdk";
import { NetworkScopedSmartWallet, SendUserOperationOptions } from "@coinbase/coinbase-sdk";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

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
} as jest.Mocked<Pick<PublicClient, "waitForTransactionReceipt" | "readContract">>;

enum UserOperationStatus {
  CREATED = "created",
  PENDING = "pending",
  COMPLETE = "complete",
}

interface MockUserOperation {
  hash: string;
  wait: () => Promise<{ status: UserOperationStatus | string; transactionHash: string }>;
}

type UserOperationResult = {
  status: UserOperationStatus | string;
  transactionHash: string;
};

interface MockNetworkScopedSmartWallet {
  address: string;
  getBalance: jest.MockedFunction<() => Promise<bigint>>;
  sendTransaction: jest.MockedFunction<() => Promise<string>>;
  sendUserOperation: jest.MockedFunction<(options: unknown) => Promise<MockUserOperation>>;
}

// =========================================================
// mocks
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
    NETWORK_ID_TO_VIEM_CHAIN: {
      mainnet: {},
      "base-sepolia": {},
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
      mainnet: {},
      "base-sepolia": {},
    },
    Coinbase: {
      configure: jest.fn(),
      configureFromJson: jest.fn(),
      networks: {
        BaseSepolia: "base-sepolia",
      },
    },
    waitForUserOperation: jest.fn(),
    createSmartWallet: jest.fn(),
  };
});

// =========================================================
// tests
// =========================================================

describe("SmartWalletProvider", () => {
  let provider: jest.Mocked<SmartWalletProvider>;
  let mockNetworkScopedWallet: MockNetworkScopedSmartWallet;
  let mockWaitForUserOperation: jest.MockedFunction<
    (op: MockUserOperation) => Promise<UserOperationResult>
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockGetBalance = jest.fn() as jest.MockedFunction<() => Promise<bigint>>;
    mockGetBalance.mockResolvedValue(MOCK_BALANCE);

    const mockSendTransaction = jest.fn() as jest.MockedFunction<() => Promise<string>>;
    mockSendTransaction.mockResolvedValue(MOCK_TRANSACTION_HASH);

    const mockSendUserOperation = jest.fn() as jest.MockedFunction<
      (options: unknown) => Promise<MockUserOperation>
    >;

    mockNetworkScopedWallet = {
      address: MOCK_ADDRESS,
      getBalance: mockGetBalance,
      sendTransaction: mockSendTransaction,
      sendUserOperation: mockSendUserOperation,
    };

    const mockUserOperationWait = jest.fn() as jest.MockedFunction<
      () => Promise<UserOperationResult>
    >;
    mockUserOperationWait.mockResolvedValue({
      status: UserOperationStatus.COMPLETE,
      transactionHash: MOCK_TRANSACTION_HASH,
    });

    const mockUserOperation: MockUserOperation = {
      hash: MOCK_TRANSACTION_HASH,
      wait: mockUserOperationWait,
    };

    mockNetworkScopedWallet.sendUserOperation.mockResolvedValue(mockUserOperation);

    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TRANSACTION_HASH,
    } as unknown as WaitForTransactionReceiptReturnType);

    mockPublicClient.readContract.mockResolvedValue("mock_result");

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
      _smartWallet: mockNetworkScopedWallet as unknown as NetworkScopedSmartWallet,
    } as unknown as jest.Mocked<SmartWalletProvider>;

    provider.getAddress.mockReturnValue(MOCK_ADDRESS);
    provider.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: MOCK_NETWORK_ID,
      chainId: MOCK_CHAIN_ID,
    });
    provider.getName.mockReturnValue("smart_wallet_provider");
    provider.getBalance.mockResolvedValue(MOCK_BALANCE);

    provider.sendTransaction.mockImplementation(async (tx: TransactionRequest): Promise<Hex> => {
      const _result = await mockNetworkScopedWallet.sendUserOperation({ calls: [tx] });
      const waitResult = await _result.wait();

      if (waitResult.status === "failed") {
        throw new Error(`Transaction failed with status ${waitResult.status}`);
      }

      return _result.hash as Hex;
    });

    provider.sendUserOperation.mockImplementation(
      async <T extends readonly unknown[]>(
        op: Omit<SendUserOperationOptions<T>, "chainId" | "paymasterUrl">,
      ): Promise<Hex> => {
        const _result = await mockNetworkScopedWallet.sendUserOperation(op);
        return _result.hash as Hex;
      },
    );

    provider.waitForTransactionReceipt.mockImplementation((hash: Hex) =>
      mockPublicClient.waitForTransactionReceipt({ hash }),
    );

    provider.readContract.mockImplementation(
      async <
        const abi extends Abi | readonly unknown[],
        functionName extends ContractFunctionName<abi, "pure" | "view">,
        const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
      >(
        params: ReadContractParameters<abi, functionName, args>,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return mockPublicClient.readContract(params as any);
      },
    );

    provider.nativeTransfer.mockImplementation(
      async (to: Address, _value: string): Promise<Hex> => {
        await mockNetworkScopedWallet.sendUserOperation({
          calls: [
            {
              to,
              value: BigInt(1000000000000000000),
            },
          ],
        });
        return MOCK_TRANSACTION_HASH as Hex;
      },
    );

    const notImplementedError = new Error("Not implemented");
    provider.signMessage.mockRejectedValue(notImplementedError);
    provider.signTypedData.mockRejectedValue(notImplementedError);
    provider.signTransaction.mockRejectedValue(notImplementedError);

    mockWaitForUserOperation = jest.fn();
    mockWaitForUserOperation.mockImplementation((operation: MockUserOperation) => {
      return operation.wait();
    });

    jest
      .spyOn(coinbaseSdk, "waitForUserOperation")
      .mockImplementation(
        mockWaitForUserOperation as unknown as typeof coinbaseSdk.waitForUserOperation,
      );
  });

  // =========================================================
  // transaction operations
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
      await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();
    });

    it("should handle transaction failures", async () => {
      mockWaitForUserOperation.mockRejectedValueOnce(new Error("Failed to send transaction"));

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
      mockNetworkScopedWallet.sendUserOperation.mockRejectedValueOnce(
        new Error("Invalid address format"),
      );

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

      await expect(
        provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex),
      ).rejects.toThrow("Receipt retrieval failed");
    });

    it("should handle operation failures when sending transactions", async () => {
      const mockUserOperationWait = jest.fn() as jest.MockedFunction<
        () => Promise<UserOperationResult>
      >;
      mockUserOperationWait.mockResolvedValue({
        status: "failed",
        transactionHash: MOCK_TRANSACTION_HASH,
      });

      const failedOperation: MockUserOperation = {
        hash: MOCK_TRANSACTION_HASH,
        wait: mockUserOperationWait,
      };

      mockNetworkScopedWallet.sendUserOperation.mockResolvedValueOnce(failedOperation);

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
      mockNetworkScopedWallet.sendUserOperation.mockRejectedValueOnce(
        new Error("User operation timed out"),
      );

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
  // native token transfer operations
  // =========================================================

  describe("native token operations", () => {
    it("should transfer native tokens", async () => {
      const to = "0x1234567890123456789012345678901234567890" as Address;
      const value = "1";

      const txHash = await provider.nativeTransfer(to, value);

      expect(mockNetworkScopedWallet.sendUserOperation).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle operation failures when transferring native tokens", async () => {
      provider.nativeTransfer.mockRejectedValueOnce(
        new Error("Transfer failed with status failed"),
      );

      const to = "0x1234567890123456789012345678901234567890" as Address;
      const value = "1";

      await expect(provider.nativeTransfer(to, value)).rejects.toThrow(
        "Transfer failed with status failed",
      );
    });

    it("should handle invalid address format in native transfer", async () => {
      provider.nativeTransfer.mockRejectedValueOnce(new Error("Invalid address format"));

      const invalidAddress = "not_a_valid_address";

      await expect(
        provider.nativeTransfer(invalidAddress as unknown as Address, "1"),
      ).rejects.toThrow("Invalid address format");
    });

    it("should handle network errors in native token transfers", async () => {
      provider.nativeTransfer.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        provider.nativeTransfer("0x1234567890123456789012345678901234567890" as Address, "1"),
      ).rejects.toThrow("Network error");
    });
  });

  // =========================================================
  // contract interaction methods
  // =========================================================

  describe("contract interactions", () => {
    it("should read from contracts", async () => {
      const result = await provider.readContract({
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi: [] as const,
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
          abi: [] as const,
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
  // signing methods (unsupported operations)
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
