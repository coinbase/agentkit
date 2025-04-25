import { CdpClient } from "@coinbase/cdp-sdk";
import {
  Connection,
  MessageV0,
  PublicKey,
  RpcResponseAndContext,
  SignatureResult,
  SignatureStatus,
  VersionedTransaction,
} from "@solana/web3.js";
import { Network } from "../network";
import { CdpV2SolanaWalletProvider } from "./cdpV2SolanaWalletProvider";

// =========================================================
// consts
// =========================================================

const mockConnection = {
  sendTransaction: jest.fn(),
  getBalance: jest.fn(),
  getLatestBlockhash: jest.fn(),
  getSignatureStatus: jest.fn(),
  confirmTransaction: jest.fn(),
} as unknown as jest.Mocked<Connection>;

// =========================================================
// mocks
// =========================================================

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("../../package.json", () => ({
  version: "1.0.0",
}));

jest.mock("@solana/web3.js", () => {
  const mockPublicKey = {
    toBase58: () => MOCK_ADDRESS,
    equals: () => true,
  };

  const MockPublicKey = jest.fn(() => mockPublicKey);
  MockPublicKey.prototype = mockPublicKey;

  return {
    Connection: jest.fn(() => mockConnection),
    PublicKey: MockPublicKey,
    VersionedTransaction: jest.fn().mockImplementation(() => ({
      serialize: jest.fn(() => Buffer.from("mock-serialized-tx")),
      addSignature: jest.fn(),
    })),
    MessageV0: {
      compile: jest.fn(),
    },
    SystemProgram: {
      transfer: jest.fn(),
    },
    ComputeBudgetProgram: {
      setComputeUnitPrice: jest.fn(),
      setComputeUnitLimit: jest.fn(),
    },
    clusterApiUrl: jest.fn((cluster: string) => {
      switch (cluster) {
        case "mainnet-beta":
          return "https://api.mainnet-beta.solana.com";
        case "devnet":
          return "https://api.devnet.solana.com";
        case "testnet":
          return "https://api.testnet.solana.com";
        default:
          return "https://api.devnet.solana.com";
      }
    }),
    LAMPORTS_PER_SOL: 1000000000,
  };
});

// Mock CdpClient
jest.mock("@coinbase/cdp-sdk", () => {
  const MOCK_ADDRESS = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
  const MOCK_SIGNATURE = "5HxWvvfubhXpYYpS3tJkw6fq9jE9j18THftkZjrrVHx6";

  const mockCreateAccount = jest.fn().mockImplementation(() =>
    Promise.resolve({
      address: MOCK_ADDRESS,
      signTransaction: jest.fn().mockResolvedValue({ signature: MOCK_SIGNATURE }),
    }),
  );

  const mockSignTransaction = jest
    .fn()
    .mockImplementation(async () => ({ signature: MOCK_SIGNATURE }));

  const mockSolanaClient = {
    createAccount: mockCreateAccount as jest.MockedFunction<typeof mockCreateAccount>,
    getAccount: jest.fn(),
    signTransaction: mockSignTransaction,
  };

  return {
    CdpClient: jest.fn().mockImplementation(() => ({
      solana: mockSolanaClient,
    })),
  };
});

// =========================================================
// test constants
// =========================================================

const MOCK_ADDRESS = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const MOCK_NETWORK_ID = "solana-mainnet";
const MOCK_SIGNATURE = "5HxWvvfubhXpYYpS3tJkw6fq9jE9j18THftkZjrrVHx6";
const MOCK_BALANCE = 1000000000n; // 1 SOL in lamports
const MOCK_NETWORK: Network = {
  protocolFamily: "svm",
  networkId: MOCK_NETWORK_ID,
  chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", // Solana mainnet chain ID
};
const MOCK_SIGNATURE_RESULT = {
  value: {
    err: null,
    slot: 123456,
    confirmations: 32,
  },
  context: {
    slot: 123456,
  },
} as RpcResponseAndContext<SignatureResult>;

describe("CdpV2SolanaWalletProvider", () => {
  let provider: CdpV2SolanaWalletProvider;
  let mockCdpClient: jest.Mocked<CdpClient>;
  let mockServerAccount: jest.Mocked<
    Awaited<ReturnType<typeof CdpClient.prototype.solana.createAccount>>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCdpClient = new CdpClient({
      apiKeyId: "test-key-id",
      apiKeySecret: "test-key-secret",
      walletSecret: "test-wallet-secret",
    }) as jest.Mocked<CdpClient>;

    mockServerAccount = {
      address: MOCK_ADDRESS,
      signTransaction: jest.fn().mockResolvedValue({ signature: MOCK_SIGNATURE }),
    } as unknown as jest.Mocked<
      Awaited<ReturnType<typeof CdpClient.prototype.solana.createAccount>>
    >;

    // Set up the mock server account for the provider
    (
      mockCdpClient.solana.createAccount as jest.MockedFunction<
        typeof mockCdpClient.solana.createAccount
      >
    ).mockResolvedValue(mockServerAccount);
    mockCdpClient.solana.signTransaction = jest
      .fn()
      .mockResolvedValue({ signature: MOCK_SIGNATURE });

    mockConnection.getBalance.mockResolvedValue(Number(MOCK_BALANCE));
    mockConnection.getLatestBlockhash.mockResolvedValue({
      blockhash: "test-blockhash",
      lastValidBlockHeight: 123456,
    });
    mockConnection.confirmTransaction.mockResolvedValue(MOCK_SIGNATURE_RESULT);
    mockConnection.sendTransaction.mockResolvedValue(MOCK_SIGNATURE);

    provider = await CdpV2SolanaWalletProvider.configureWithWallet({
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
      const provider = await CdpV2SolanaWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
        networkId: MOCK_NETWORK_ID,
      });

      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should default to solana-devnet if network not provided", async () => {
      const provider = await CdpV2SolanaWalletProvider.configureWithWallet({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
      });

      expect(provider.getNetwork().networkId).toBe("solana-devnet");
    });

    it("should handle initialization failures gracefully", async () => {
      const mockCreateAccount = jest.fn().mockRejectedValue(new Error("Failed to create account"));
      const mockSolanaClient = {
        createAccount: mockCreateAccount,
        getAccount: jest.fn(),
        signTransaction: jest.fn(),
      };

      const mockCdpClient = new CdpClient({
        apiKeyId: "test-key-id",
        apiKeySecret: "test-key-secret",
        walletSecret: "test-wallet-secret",
      }) as jest.Mocked<CdpClient>;
      mockCdpClient.solana = mockSolanaClient as unknown as typeof mockCdpClient.solana;

      (CdpClient as jest.MockedClass<typeof CdpClient>).mockImplementation(() => mockCdpClient);

      await expect(
        CdpV2SolanaWalletProvider.configureWithWallet({
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
      expect(provider.getName()).toBe("cdp_v2_solana_wallet_provider");
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(MOCK_BALANCE);
      expect(mockConnection.getBalance).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should handle connection errors during balance check", async () => {
      mockConnection.getBalance.mockRejectedValueOnce(new Error("Network connection error"));

      await expect(provider.getBalance()).rejects.toThrow("Network connection error");
    });
  });

  // =========================================================
  // transaction operation tests
  // =========================================================

  describe("transaction operations", () => {
    it("should sign transactions", async () => {
      const mockTransaction = new VersionedTransaction(
        MessageV0.compile({
          payerKey: new PublicKey(MOCK_ADDRESS),
          instructions: [],
          recentBlockhash: "test-blockhash",
        }),
      );

      const signedTx = await provider.signTransaction(mockTransaction);
      expect(mockCdpClient.solana.signTransaction).toHaveBeenCalledWith({
        transaction: expect.any(String),
        address: MOCK_ADDRESS,
      });
      expect(signedTx).toBe(mockTransaction);
    });

    it("should send transactions", async () => {
      const mockTransaction = new VersionedTransaction(
        MessageV0.compile({
          payerKey: new PublicKey(MOCK_ADDRESS),
          instructions: [],
          recentBlockhash: "test-blockhash",
        }),
      );

      const signature = await provider.sendTransaction(mockTransaction);
      expect(mockConnection.sendTransaction).toHaveBeenCalledWith(mockTransaction);
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign and send transactions", async () => {
      const mockTransaction = new VersionedTransaction(
        MessageV0.compile({
          payerKey: new PublicKey(MOCK_ADDRESS),
          instructions: [],
          recentBlockhash: "test-blockhash",
        }),
      );

      const signature = await provider.signAndSendTransaction(mockTransaction);
      expect(mockCdpClient.solana.signTransaction).toHaveBeenCalled();
      expect(mockConnection.sendTransaction).toHaveBeenCalled();
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should handle transaction failures during send", async () => {
      mockConnection.sendTransaction.mockRejectedValueOnce(new Error("Transaction failed"));

      const mockTransaction = new VersionedTransaction(
        MessageV0.compile({
          payerKey: new PublicKey(MOCK_ADDRESS),
          instructions: [],
          recentBlockhash: "test-blockhash",
        }),
      );

      await expect(provider.sendTransaction(mockTransaction)).rejects.toThrow("Transaction failed");
    });

    it("should get signature status", async () => {
      const mockStatus = {
        value: {
          slot: 123456,
          confirmations: 32,
          err: null,
        },
        context: {
          slot: 123456,
        },
      } as RpcResponseAndContext<SignatureStatus | null>;

      mockConnection.getSignatureStatus.mockResolvedValue(mockStatus);

      const status = await provider.getSignatureStatus(MOCK_SIGNATURE);
      expect(status).toBe(mockStatus);
      expect(mockConnection.getSignatureStatus).toHaveBeenCalledWith(MOCK_SIGNATURE, undefined);
    });

    it("should wait for signature result", async () => {
      const result = await provider.waitForSignatureResult(MOCK_SIGNATURE);
      expect(result).toBe(MOCK_SIGNATURE_RESULT);
      expect(mockConnection.confirmTransaction).toHaveBeenCalledWith({
        signature: MOCK_SIGNATURE,
        lastValidBlockHeight: 123456,
        blockhash: "test-blockhash",
      });
    });
  });

  // =========================================================
  // native transfer tests
  // =========================================================

  describe("native transfer", () => {
    it("should transfer SOL", async () => {
      const toAddress = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
      const amount = "1.0";

      // Set a balance that's high enough to cover the transfer + fees
      mockConnection.getBalance.mockResolvedValueOnce(Number(2000000000n)); // 2 SOL

      const signature = await provider.nativeTransfer(toAddress, amount);
      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockConnection.sendTransaction).toHaveBeenCalled();
    });

    it("should handle insufficient balance", async () => {
      mockConnection.getBalance.mockResolvedValueOnce(Number(1000000n)); // 0.001 SOL

      const toAddress = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
      const amount = "1.0";

      await expect(provider.nativeTransfer(toAddress, amount)).rejects.toThrow(
        "Insufficient balance",
      );
    });

    it("should handle invalid address", async () => {
      const invalidAddress = "invalid-address";
      const amount = "1.0";

      await expect(provider.nativeTransfer(invalidAddress, amount)).rejects.toThrow();
    });
  });
});
