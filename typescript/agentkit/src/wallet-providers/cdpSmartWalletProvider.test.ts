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
  waitForTransactionReceipt: jest.fn(),
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
    toEventSelector: jest.requireActual("viem").toEventSelector,
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
      sign: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
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
    it("should sign a hash using owner account", async () => {
      const testHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const signature = await provider.sign(testHash);

      expect(mockOwnerAccount.sign).toHaveBeenCalledWith({ hash: testHash });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign typed data using smart account", async () => {
      const typedData = {
        domain: {
          name: "Example",
          version: "1",
          chainId: 1,
          verifyingContract: "0x1234567890123456789012345678901234567890",
        },
        types: {
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" },
          ],
        },
        primaryType: "Person",
        message: {
          name: "Bob",
          wallet: "0x1234567890123456789012345678901234567890",
        },
      };

      // Mock the smart account's signTypedData method
      mockSmartAccount.signTypedData = jest.fn().mockResolvedValue(MOCK_SIGNATURE);

      const signature = await provider.signTypedData(typedData);

      // Verify the smart account was called with the correct parameters
      expect(mockSmartAccount.signTypedData).toHaveBeenCalledWith({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
        network: MOCK_NETWORK.networkId,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should throw error for direct transaction signing", async () => {
      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.signTransaction(tx)).rejects.toThrow(
        "Direct transaction signing not supported for smart wallets. Use sendTransaction instead.",
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
  // transaction receipt tests
  // =========================================================

  describe("transaction receipts", () => {
    // derived from the EntryPoint ABI, independently of the provider, so a wrong topic in the
    // provider fails these tests by name instead of passing while production never matches
    const { toEventSelector } = jest.requireActual<typeof import("viem")>("viem");
    const USER_OPERATION_EVENT_TOPIC = toEventSelector(
      "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
    );
    const MOCK_TX_HASH = "0x9999999999999999999999999999999999999999999999999999999999999999";
    const word = (n: number) => n.toString(16).padStart(64, "0");
    const userOpEvent = (userOpHash: string, success: boolean) => ({
      topics: [
        USER_OPERATION_EVENT_TOPIC,
        userOpHash,
        "0x" + word(0),
        "0x" + word(0),
      ] as `0x${string}`[],
      data: ("0x" + word(7) + word(success ? 1 : 0) + word(1000) + word(50000)) as `0x${string}`,
    });
    const transferLog = {
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      ] as `0x${string}`[],
      data: ("0x" + word(1000000)) as `0x${string}`,
    };
    const setUserOperation = (receipt: Record<string, unknown>) => {
      (mockCdpClient.evm as unknown as { waitForUserOperation: jest.Mock }).waitForUserOperation =
        jest.fn().mockResolvedValue(receipt);
    };

    beforeEach(() => {
      setUserOperation({
        status: "complete",
        transactionHash: MOCK_TX_HASH,
        userOpHash: MOCK_USER_OP_HASH,
      });
    });

    it("should keep the complete status and attach the logs when the operation succeeded", async () => {
      const logs = [transferLog, userOpEvent(MOCK_USER_OP_HASH, true)];
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
        logs,
      } as never);

      const receipt = await provider.waitForTransactionReceipt(MOCK_USER_OP_HASH);

      expect(receipt.status).toBe("complete");
      expect(receipt.logs).toEqual(logs);
    });

    it("should report failed when the bundle was mined but the operation reverted", async () => {
      const logs = [userOpEvent(MOCK_USER_OP_HASH, false)];
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
        logs,
      } as never);

      const receipt = await provider.waitForTransactionReceipt(MOCK_USER_OP_HASH);

      expect(receipt.status).toBe("failed");
      expect(receipt.transactionHash).toBe(MOCK_TX_HASH);
      expect(receipt.logs).toEqual(logs);
    });

    it("should use the UserOperationEvent topic the EntryPoint emits", () => {
      expect(USER_OPERATION_EVENT_TOPIC).toBe(
        "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f",
      );
    });

    it("should leave the status alone when the logs hold no event for this operation", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const otherHash = "0x1111111111111111111111111111111111111111111111111111111111111111";
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
        logs: [transferLog, userOpEvent(otherHash, false)],
      } as never);

      const receipt = await provider.waitForTransactionReceipt(MOCK_USER_OP_HASH);

      expect(receipt.status).toBe("complete");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("No UserOperationEvent for"));
      warn.mockRestore();
    });

    it("should return a receipt that is not complete without reading the bundle transaction", async () => {
      setUserOperation({ status: "failed", userOpHash: MOCK_USER_OP_HASH });

      const receipt = await provider.waitForTransactionReceipt(MOCK_USER_OP_HASH);

      expect(receipt.status).toBe("failed");
      expect(mockPublicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
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
