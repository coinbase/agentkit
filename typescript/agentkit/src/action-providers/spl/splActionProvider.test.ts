import {
  RpcResponseAndContext,
  SignatureResult,
  SendTransactionError,
  Connection,
  PublicKey,
} from "@solana/web3.js";

import { SplActionProvider } from "./splActionProvider";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { Network } from "../../network";

type Mint = {
  decimals: number;
};

type Account = {
  amount: bigint;
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  delegate: null;
  delegatedAmount: bigint;
  closeAuthority: null;
  isFrozen: boolean;
  isNative: boolean;
  rentExemptReserve: null;
  isInitialized: boolean;
  tlvData: Map<unknown, unknown>;
};

jest.mock("@solana/web3.js", () => ({
  ...jest.requireActual("@solana/web3.js"),
  Connection: jest.fn(),
  SendTransactionError: jest.fn().mockReturnValue({
    message: "Failed to send",
    toString: () => "Failed to send",
  }),
  VersionedTransaction: jest.fn().mockReturnValue({
    sign: jest.fn(),
  }),
  MessageV0: {
    compile: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("@solana/spl-token", () => {
  /**
   * Custom error class for token account not found scenarios.
   * Used to simulate cases where a token account doesn't exist.
   */
  class TokenAccountNotFoundError extends Error {
    /**
     * Creates a new TokenAccountNotFoundError instance.
     * Sets the error message and name to identify token account not found scenarios.
     */
    constructor() {
      super("Token account not found");
      this.name = "TokenAccountNotFoundError";
    }
  }

  return {
    getAssociatedTokenAddress: jest.fn(),
    getMint: jest.fn(),
    getAccount: jest.fn(),
    createAssociatedTokenAccountInstruction: jest.fn(),
    createTransferCheckedInstruction: jest.fn(),
    TokenAccountNotFoundError,
  };
});

jest.mock("../../wallet-providers/svmWalletProvider");

describe("SplActionProvider", () => {
  let actionProvider: SplActionProvider;
  let mockWallet: jest.Mocked<SvmWalletProvider>;
  let mockConnection: jest.Mocked<Connection>;
  let mockGetAssociatedTokenAddress: jest.Mock;
  let mockGetMint: jest.Mock;
  let mockGetAccount: jest.Mock;

  /**
   * Set up test environment before each test.
   * Initializes mocks and creates fresh instances of required objects.
   */
  beforeEach(() => {
    jest.clearAllMocks();

    const mocked = jest.requireMock("@solana/spl-token");
    mockGetAssociatedTokenAddress = mocked.getAssociatedTokenAddress;
    mockGetMint = mocked.getMint;
    mockGetAccount = mocked.getAccount;

    mockGetMint.mockResolvedValue({ decimals: 6 } as Mint);
    mockGetAccount.mockRejectedValue(new Error("getAccount mock not implemented for this test"));

    actionProvider = new SplActionProvider();
    mockConnection = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: "mockedBlockhash" }),
    } as unknown as jest.Mocked<Connection>;

    const MOCK_SIGNATURE = "mock-signature";
    const mockSignatureReceipt: RpcResponseAndContext<SignatureResult> = {
      context: { slot: 1234 },
      value: { err: null },
    };

    mockWallet = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getPublicKey: jest.fn().mockReturnValue(new PublicKey("11111111111111111111111111111111")),
      signAndSendTransaction: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
      waitForSignatureResult: jest.fn().mockResolvedValue(mockSignatureReceipt),
      getAddress: jest.fn().mockReturnValue("11111111111111111111111111111111"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "svm", networkId: "mainnet" }),
      getName: jest.fn().mockReturnValue("mock-wallet"),
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<SvmWalletProvider>;
  });

  describe("constructor", () => {
    /**
     * Test that the SPL action provider is created with the correct name.
     */
    it("should create a provider with correct name", () => {
      expect(actionProvider["name"]).toBe("spl");
    });
  });

  describe("supportsNetwork", () => {
    /**
     * Test that the provider correctly identifies Solana networks as supported.
     */
    it("should return true for Solana networks", () => {
      const network: Network = {
        protocolFamily: "svm",
        networkId: "solana-mainnet",
      };
      expect(actionProvider.supportsNetwork(network)).toBe(true);
    });

    /**
     * Test that the provider correctly identifies non-Solana networks as unsupported.
     */
    it("should return false for non-Solana networks", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      };
      expect(actionProvider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("transfer", () => {
    const MINT_ADDRESS = "So11111111111111111111111111111111111111112";
    const RECIPIENT_ADDRESS = "DjXsn34uz8yCBQ8bevLrEPYYC1RvhHvjzuVF8opNc4K2";
    const SENDER_ADDRESS = "11111111111111111111111111111111";
    const MOCK_SIGNATURE = "mock-signature";

    const transferArgs = {
      recipient: RECIPIENT_ADDRESS,
      mintAddress: MINT_ADDRESS,
      amount: 100,
    };

    const mockTokenAccount = {
      amount: BigInt(1000000000),
      address: new PublicKey(MINT_ADDRESS),
      mint: new PublicKey(MINT_ADDRESS),
      owner: new PublicKey(RECIPIENT_ADDRESS),
      delegate: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
      isFrozen: false,
      isNative: false,
      rentExemptReserve: null,
      isInitialized: true,
      tlvData: new Map(),
    } as unknown as Account;

    const mockSignatureReceipt: RpcResponseAndContext<SignatureResult> = {
      context: { slot: 1234 },
      value: { err: null },
    };

    beforeEach(() => {
      mockWallet.getPublicKey.mockReturnValue(new PublicKey(SENDER_ADDRESS));
      mockWallet.getAddress.mockReturnValue(SENDER_ADDRESS);
      mockWallet.signAndSendTransaction.mockResolvedValue(MOCK_SIGNATURE);
      mockWallet.waitForSignatureResult.mockResolvedValue(mockSignatureReceipt);
    });

    /**
     * Test successful SPL token transfer with all required steps:
     * - Account validation
     * - Instruction creation
     * - Signing
     * - Sending
     * - Receipt confirmation
     */
    it("should successfully transfer SPL tokens", async () => {
      mockGetAccount.mockResolvedValue(mockTokenAccount);

      const result = await actionProvider.transfer(mockWallet, transferArgs);

      expect(mockGetAssociatedTokenAddress).toHaveBeenNthCalledWith(
        1,
        new PublicKey(transferArgs.mintAddress),
        new PublicKey(SENDER_ADDRESS),
      );

      expect(mockGetAssociatedTokenAddress).toHaveBeenNthCalledWith(
        2,
        new PublicKey(transferArgs.mintAddress),
        new PublicKey(transferArgs.recipient),
      );

      expect(mockGetMint).toHaveBeenCalledWith(
        mockConnection,
        new PublicKey(transferArgs.mintAddress),
      );
      expect(mockGetAccount).toHaveBeenCalled();
      expect(mockWallet.signAndSendTransaction).toHaveBeenCalled();
      expect(mockWallet.waitForSignatureResult).toHaveBeenCalledWith(MOCK_SIGNATURE);

      expect(result).toContain(`Successfully transferred ${transferArgs.amount} tokens`);
      expect(result).toContain(`to ${transferArgs.recipient}`);
      expect(result).toContain(`Token mint: ${transferArgs.mintAddress}`);
      expect(result).toContain(`Signature: ${MOCK_SIGNATURE}`);
    });

    /**
     * Test handling of insufficient balance.
     * Verifies that the provider properly checks token balances and prevents transfers when funds are insufficient.
     */
    it("should handle insufficient balance", async () => {
      mockGetAccount.mockResolvedValue({
        ...mockTokenAccount,
        amount: BigInt(10000000),
      });

      const result = await actionProvider.transfer(mockWallet, transferArgs);
      expect(result).toBe(
        "Error transferring SPL tokens: Error: Insufficient token balance. Have 10000000, need 100000000",
      );
    });

    /**
     * Test handling of Solana-specific send errors.
     * Verifies that the provider properly handles and reports SendTransactionError instances.
     */
    it("should handle SendTransactionError", async () => {
      mockGetAccount.mockResolvedValue(mockTokenAccount);
      const error = new SendTransactionError({
        logs: [],
        action: "send",
        signature: "mock-signature",
        transactionMessage: "Failed to send",
      });
      mockWallet.signAndSendTransaction.mockRejectedValue(error);

      const result = await actionProvider.transfer(mockWallet, transferArgs);
      expect(result).toBe("Error transferring SPL tokens: Failed to send");
    });

    /**
     * Test handling of general errors during transfer.
     * Verifies that the provider properly handles and reports unexpected errors.
     */
    it("should handle regular errors", async () => {
      mockGetAccount.mockResolvedValue(mockTokenAccount);
      const error = new Error("Regular error message");
      mockWallet.signAndSendTransaction.mockRejectedValue(error);

      const result = await actionProvider.transfer(mockWallet, transferArgs);
      expect(result).toBe("Error transferring SPL tokens: Error: Regular error message");
    });

    /**
     * Test that ATA is created by default when missing
     */
    it("should create ATA by default when missing", async () => {
      mockGetAccount
        .mockResolvedValueOnce(mockTokenAccount)
        .mockRejectedValueOnce(new Error("Account does not exist"))
        .mockResolvedValue(mockTokenAccount);

      const result = await actionProvider.transfer(mockWallet, transferArgs);

      const { createAssociatedTokenAccountInstruction } = jest.requireMock("@solana/spl-token");
      expect(createAssociatedTokenAccountInstruction).toHaveBeenCalled();
      expect(result).toContain(`Successfully transferred ${transferArgs.amount} tokens`);
    });
  });

  /**
   * Tests for the getBalance method
   */
  describe("getBalance", () => {
    const MINT_ADDRESS = "So11111111111111111111111111111111111111112";
    const TARGET_ADDRESS = "DjXsn34uz8yCBQ8bevLrEPYYC1RvhHvjzuVF8opNc4K2";
    const SENDER_ADDRESS = "11111111111111111111111111111111";

    const balanceArgs = {
      mintAddress: MINT_ADDRESS,
    };

    const balanceWithAddressArgs = {
      mintAddress: MINT_ADDRESS,
      address: TARGET_ADDRESS,
    };

    const mockTokenAccount = {
      amount: BigInt(1000000000),
      address: new PublicKey(MINT_ADDRESS),
      mint: new PublicKey(MINT_ADDRESS),
      owner: new PublicKey(TARGET_ADDRESS),
      delegate: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
      isFrozen: false,
      isNative: false,
      rentExemptReserve: null,
      isInitialized: true,
      tlvData: new Map(),
    } as unknown as Account;

    beforeEach(() => {
      mockWallet.getPublicKey.mockReturnValue(new PublicKey(SENDER_ADDRESS));
      mockWallet.getAddress.mockReturnValue(SENDER_ADDRESS);
    });

    /**
     * Tests that getBalance returns the correct balance for the connected wallet
     * when no specific address is provided.
     */
    it("should get balance for connected wallet", async () => {
      mockGetAccount.mockResolvedValue(mockTokenAccount);

      const result = await actionProvider.getBalance(mockWallet, balanceArgs);

      expect(mockGetAssociatedTokenAddress).toHaveBeenCalledWith(
        new PublicKey(balanceArgs.mintAddress),
        new PublicKey(SENDER_ADDRESS),
      );

      expect(mockGetMint).toHaveBeenCalledWith(
        mockConnection,
        new PublicKey(balanceArgs.mintAddress),
      );
      expect(mockGetAccount).toHaveBeenCalled();

      expect(result).toBe(`Balance for ${SENDER_ADDRESS} is 1000 tokens`);
    });

    /**
     * Tests that getBalance returns the correct balance when a specific
     * address is provided in the arguments.
     */
    it("should get balance for specified address", async () => {
      mockGetAccount.mockResolvedValue(mockTokenAccount);

      const result = await actionProvider.getBalance(mockWallet, balanceWithAddressArgs);

      expect(mockGetAssociatedTokenAddress).toHaveBeenCalledWith(
        new PublicKey(balanceWithAddressArgs.mintAddress),
        new PublicKey(balanceWithAddressArgs.address),
      );

      expect(mockGetMint).toHaveBeenCalledWith(
        mockConnection,
        new PublicKey(balanceWithAddressArgs.mintAddress),
      );
      expect(mockGetAccount).toHaveBeenCalled();

      expect(result).toBe(`Balance for ${TARGET_ADDRESS} is 1000 tokens`);
    });

    /**
     * Tests that getBalance correctly handles the case where a token account
     * does not exist, returning a zero balance instead of an error.
     */
    it("should handle non-existent token account", async () => {
      const { TokenAccountNotFoundError } = jest.requireMock("@solana/spl-token");
      mockGetAccount.mockRejectedValue(new TokenAccountNotFoundError());

      const result = await actionProvider.getBalance(mockWallet, balanceArgs);
      expect(result).toBe(`Balance for ${SENDER_ADDRESS} is 0 tokens`);
    });

    /**
     * Tests that getBalance properly handles and reports unexpected errors
     * that occur during the balance check.
     */
    it("should handle errors", async () => {
      const error = new Error("Test error");
      mockGetAccount.mockRejectedValue(error);

      const result = await actionProvider.getBalance(mockWallet, balanceArgs);
      expect(result).toBe("Error getting SPL token balance: Error: Test error");
    });
  });
});
