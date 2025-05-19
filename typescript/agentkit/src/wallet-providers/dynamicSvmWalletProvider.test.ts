import { DynamicSvmWalletProvider } from "./dynamicSvmWalletProvider";
import { DynamicSvmWalletClient } from "@dynamic-labs-wallet/node-svm";
import { Connection, clusterApiUrl, PublicKey, VersionedTransaction, MessageV0 } from "@solana/web3.js";
import { createDynamicWallet } from "./dynamicShared";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";

jest.mock("@dynamic-labs-wallet/node-svm");
jest.mock("../network/svm", () => ({
  SOLANA_CLUSTER_ID_BY_NETWORK_ID: {
    "": "mainnet-beta",
    "mainnet-beta": "mainnet-beta",
    "testnet": "testnet",
    "devnet": "devnet",
  },
}));
jest.mock("@solana/web3.js", () => {
  const actual = jest.requireActual("@solana/web3.js");
  const mockVersionedTransaction = jest.fn().mockImplementation(message => {
    const tx = {
      signatures: [],
      message: message || { compiledMessage: Buffer.from([]) },
    };
    Object.setPrototypeOf(tx, actual.VersionedTransaction.prototype);
    return tx;
  });

  return {
    ...actual,
    Connection: jest.fn().mockImplementation((endpoint, commitment = "confirmed") => {
      // Store the commitment for verification
      (Connection as jest.Mock).mock.lastCall = [endpoint, commitment];
      return {
        getGenesisHash: jest.fn().mockResolvedValue("test-genesis-hash"),
        commitment,
        rpcEndpoint: endpoint,
        getBalance: jest.fn(),
        getBalanceAndContext: jest.fn(),
        sendTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
        getSignatureStatus: jest.fn().mockResolvedValue({
          context: { slot: 123 },
          value: { slot: 123, confirmations: 10, err: null },
        }),
        getLatestBlockhash: jest.fn().mockResolvedValue({
          blockhash: "test-blockhash",
          lastValidBlockHeight: 123,
        }),
      };
    }),
    PublicKey: jest.fn().mockImplementation(address => ({
      toBase58: jest.fn().mockReturnValue(address),
      toString: jest.fn().mockReturnValue(address),
      toBuffer: jest.fn().mockReturnValue(Buffer.from(address)),
      toArrayLike: jest.fn().mockReturnValue(Buffer.from(address)),
    })),
    VersionedTransaction: mockVersionedTransaction,
    MessageV0: {
      compile: jest.fn().mockReturnValue({
        compiledMessage: Buffer.from([]),
      }),
    },
    clusterApiUrl: jest.fn().mockImplementation(network => {
      // Always use mainnet-beta as default
      const networkId = network || "mainnet-beta";
      return `https://api.${networkId}.solana.com`;
    }),
  };
});
jest.mock("./dynamicShared");

const MOCK_ADDRESS = "test-address";
const MOCK_TRANSACTION_HASH = "test-tx-hash";
const MOCK_SIGNATURE_HASH = "test-signature";
const MOCK_NETWORK = {
  protocolFamily: "svm",
  chainId: undefined,
  networkId: "mainnet-beta",
};

describe("DynamicSvmWalletProvider", () => {
  const MOCK_CONFIG = {
    authToken: "test-auth-token",
    environmentId: "test-environment-id",
    baseApiUrl: "https://app.dynamicauth.com",
    baseMPCRelayApiUrl: "https://relay.dynamicauth.com",
    networkId: "mainnet-beta",
    chainType: "solana" as const,
    thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
  };

  const mockWallet = {
    accountAddress: MOCK_ADDRESS,
    publicKeyHex: "0x123",
  };

  const mockDynamicClient = {
    signMessage: jest.fn().mockResolvedValue(MOCK_SIGNATURE_HASH),
    signTransaction: jest.fn().mockImplementation(({ transaction }) => {
      // Return the transaction directly, not the whole object
      if (!(transaction instanceof VersionedTransaction)) {
        Object.setPrototypeOf(transaction, VersionedTransaction.prototype);
      }
      return transaction;
    }),
    createWalletAccount: jest.fn().mockResolvedValue({
      accountAddress: MOCK_ADDRESS,
      rawPublicKey: new Uint8Array(),
      externalServerKeyShares: [],
    }),
    deriveAccountAddress: jest.fn().mockResolvedValue({
      accountAddress: MOCK_ADDRESS,
    }),
    exportPrivateKey: jest.fn().mockResolvedValue({
      derivedPrivateKey: "test-private-key",
    }),
    importPrivateKey: jest.fn().mockResolvedValue({
      accountAddress: MOCK_ADDRESS,
      rawPublicKey: new Uint8Array(),
      externalServerKeyShares: [],
    }),
    getSvmWallets: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DynamicSvmWalletClient
    (DynamicSvmWalletClient as jest.Mock).mockImplementation(() => mockDynamicClient);

    // Mock createDynamicWallet
    (createDynamicWallet as jest.Mock).mockResolvedValue({
      wallet: mockWallet,
      dynamic: mockDynamicClient,
    });
  });

  describe("configureWithWallet", () => {
    it("should create a new wallet with Dynamic client", async () => {
      const provider = await DynamicSvmWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(createDynamicWallet).toHaveBeenCalledWith({
        ...MOCK_CONFIG,
        chainType: "solana",
      });

      expect(Connection).toHaveBeenCalledWith(
        "https://api.mainnet-beta.solana.com"
      );
      const connection = (Connection as jest.Mock).mock.results[0].value;
      expect(connection.getGenesisHash).toHaveBeenCalled();
    });

    it("should throw error when wallet creation fails", async () => {
      (createDynamicWallet as jest.Mock).mockRejectedValue(new Error("Failed to create wallet"));

      await expect(DynamicSvmWalletProvider.configureWithWallet(MOCK_CONFIG)).rejects.toThrow(
        "Failed to create wallet",
      );
    });

    it("should use provided connection when available", async () => {
      const mockConnection = {
        getGenesisHash: jest.fn().mockResolvedValue("test-genesis-hash"),
        commitment: "confirmed",
        rpcEndpoint: "https://custom-rpc.example.com",
        getBalance: jest.fn(),
        getBalanceAndContext: jest.fn(),
        sendTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
        getSignatureStatus: jest.fn().mockResolvedValue({
          context: { slot: 123 },
          value: { slot: 123, confirmations: 10, err: null },
        }),
        getLatestBlockhash: jest.fn().mockResolvedValue({
          blockhash: "test-blockhash",
          lastValidBlockHeight: 123,
        }),
      };
      const config = {
        ...MOCK_CONFIG,
        connection: mockConnection as unknown as Connection,
      };
      const provider = await DynamicSvmWalletProvider.configureWithWallet(config);

      expect(Connection).not.toHaveBeenCalled();
      expect(mockConnection.getGenesisHash).toHaveBeenCalled();
    });

    it("should use default network ID when not provided", async () => {
      const { networkId, ...configWithoutNetworkId } = MOCK_CONFIG;

      await DynamicSvmWalletProvider.configureWithWallet(configWithoutNetworkId);

      expect(clusterApiUrl).toHaveBeenCalledWith("mainnet-beta");
    });
  });

  describe("wallet methods", () => {
    let provider: DynamicSvmWalletProvider;

    beforeEach(async () => {
      provider = await DynamicSvmWalletProvider.configureWithWallet(MOCK_CONFIG);
      // Mock getNetwork to return our test network
      jest.spyOn(provider, "getNetwork").mockReturnValue(MOCK_NETWORK);
    });

    it("should get the wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("dynamic_svm_wallet_provider");
    });

    it("should sign a message using Dynamic client", async () => {
      const result = await provider.signMessage("Hello, world!");
      expect(result).toBe(MOCK_SIGNATURE_HASH);
      expect(mockDynamicClient.signMessage).toHaveBeenCalledWith({
        message: "Hello, world!",
        accountAddress: MOCK_ADDRESS,
      });
    });

    it("should sign a transaction using Dynamic client", async () => {
      const message = MessageV0.compile({
        payerKey: new PublicKey(MOCK_ADDRESS),
        instructions: [],
        recentBlockhash: "test-blockhash",
      });
      const transaction = new VersionedTransaction(message);
      const result = await provider.signTransaction(transaction);
      expect(result).toBe(transaction);
      expect(mockDynamicClient.signTransaction).toHaveBeenCalledWith({
        senderAddress: MOCK_ADDRESS,
        transaction,
      });
    });

    it("should send a transaction", async () => {
      const message = MessageV0.compile({
        payerKey: new PublicKey(MOCK_ADDRESS),
        instructions: [],
        recentBlockhash: "test-blockhash",
      });
      const transaction = new VersionedTransaction(message);
      const result = await provider.sendTransaction(transaction);
      expect(result).toBe(MOCK_TRANSACTION_HASH);
      const connection = (Connection as jest.Mock).mock.results[0].value;
      expect(connection.sendTransaction).toHaveBeenCalledWith(transaction);
    });

    it("should sign and send a transaction", async () => {
      const message = MessageV0.compile({
        payerKey: new PublicKey(MOCK_ADDRESS),
        instructions: [],
        recentBlockhash: "test-blockhash",
      });
      const transaction = new VersionedTransaction(message);
      const result = await provider.signAndSendTransaction(transaction);
      expect(result).toBe(MOCK_TRANSACTION_HASH);
      expect(mockDynamicClient.signTransaction).toHaveBeenCalledWith({
        senderAddress: MOCK_ADDRESS,
        transaction,
      });
      const connection = (Connection as jest.Mock).mock.results[0].value;
      expect(connection.sendTransaction).toHaveBeenCalledWith(transaction);
    });

    it("should get signature status", async () => {
      const result = await provider.getSignatureStatus(MOCK_TRANSACTION_HASH);
      expect(result).toEqual({
        context: { slot: 123 },
        value: { slot: 123, confirmations: 10, err: null },
      });
      const connection = (Connection as jest.Mock).mock.results[0].value;
      expect(connection.getSignatureStatus).toHaveBeenCalledWith(MOCK_TRANSACTION_HASH, undefined);
    });

    it("should wait for signature result", async () => {
      const result = await provider.waitForSignatureResult(MOCK_TRANSACTION_HASH);
      expect(result).toEqual({
        context: { slot: 123 },
        value: { slot: 123, confirmations: 10, err: null },
      });
      const connection = (Connection as jest.Mock).mock.results[0].value;
      expect(connection.getSignatureStatus).toHaveBeenCalledWith(MOCK_TRANSACTION_HASH);
    });

    it("should export wallet information", async () => {
      const result = await provider.exportWallet();
      expect(result).toEqual({
        walletId: MOCK_ADDRESS,
        chainId: undefined,
        networkId: "mainnet-beta",
      });
    });
  });
}); 