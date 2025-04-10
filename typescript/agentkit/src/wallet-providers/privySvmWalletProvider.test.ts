import { PrivySvmWalletProvider } from "./privySvmWalletProvider";
import { Connection, VersionedTransaction, clusterApiUrl as _clusterApiUrl } from "@solana/web3.js";
import * as solanaNetworks from "../network/svm";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("@privy-io/server-auth", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    walletApi: {
      getWallet: jest.fn().mockResolvedValue({
        id: "test-wallet-id",
        address: "AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM",
      }),
      create: jest.fn().mockResolvedValue({
        id: "test-wallet-id",
        address: "AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM",
      }),
      solana: {
        signTransaction: jest.fn().mockResolvedValue({
          signedTransaction: "mock-signed-transaction",
        }),
        signAndSendTransaction: jest.fn().mockResolvedValue({
          hash: "mock-hash",
        }),
      },
    },
  })),
}));

jest.mock("@solana/web3.js", () => {
  const actual = jest.requireActual("@solana/web3.js");
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getGenesisHash: jest.fn().mockResolvedValue(solanaNetworks.SOLANA_DEVNET_GENESIS_BLOCK_HASH),
      getBalance: jest.fn().mockResolvedValue(1000000000),
      getSignatureStatus: jest.fn().mockResolvedValue({
        context: { slot: 123 },
        value: { slot: 123, confirmations: 10, err: null },
      }),
      confirmTransaction: jest.fn().mockResolvedValue({
        context: { slot: 123 },
        value: { err: null },
      }),
    })),
    PublicKey: jest.fn().mockImplementation(address => ({
      toBase58: jest.fn().mockReturnValue(address),
    })),
    VersionedTransaction: jest.fn().mockImplementation(() => ({
      signatures: [],
      message: { compiledMessage: Buffer.from([]) },
    })),
    clusterApiUrl: jest.fn().mockImplementation(network => `https://api.${network}.solana.com`),
  };
});

jest.mock("./privyShared", () => ({
  createPrivyWallet: jest.fn().mockResolvedValue({
    wallet: {
      id: "test-wallet-id",
      address: "AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM",
    },
    privy: {
      walletApi: {
        solana: {
          signTransaction: jest.fn().mockResolvedValue({
            signedTransaction: "mock-signed-transaction",
          }),
          signAndSendTransaction: jest.fn().mockResolvedValue({
            hash: "mock-hash",
          }),
        },
      },
    },
  }),
}));

jest.mock("../network/svm", () => {
  const SOLANA_DEVNET_GENESIS_BLOCK_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  const SOLANA_TESTNET_GENESIS_BLOCK_HASH = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";
  const SOLANA_MAINNET_GENESIS_BLOCK_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

  return {
    SOLANA_DEVNET_GENESIS_BLOCK_HASH,
    SOLANA_TESTNET_GENESIS_BLOCK_HASH,
    SOLANA_MAINNET_GENESIS_BLOCK_HASH,
    SOLANA_CLUSTER_ID_BY_NETWORK_ID: {
      devnet: "devnet",
      testnet: "testnet",
      "mainnet-beta": "mainnet-beta",
    },
    SOLANA_NETWORKS: {
      [SOLANA_DEVNET_GENESIS_BLOCK_HASH]: {
        protocolFamily: "solana",
        chainId: "devnet",
        networkId: "devnet",
      },
      [SOLANA_TESTNET_GENESIS_BLOCK_HASH]: {
        protocolFamily: "solana",
        chainId: "testnet",
        networkId: "testnet",
      },
      [SOLANA_MAINNET_GENESIS_BLOCK_HASH]: {
        protocolFamily: "solana",
        chainId: "mainnet-beta",
        networkId: "mainnet-beta",
      },
    },
  };
});

describe("PrivySvmWalletProvider", () => {
  const MOCK_ADDRESS = "AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM";

  const MOCK_CONFIG = {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    walletType: "server" as const,
  };

  const MOCK_CONFIG_WITH_WALLET_ID = {
    ...MOCK_CONFIG,
    walletId: "test-wallet-id",
  };

  const MOCK_CONFIG_WITH_NETWORK_ID = {
    ...MOCK_CONFIG,
    networkId: "devnet",
  };

  const MOCK_CONFIG_WITH_AUTH_KEY = {
    ...MOCK_CONFIG,
    authorizationPrivateKey: "test-auth-key",
    authorizationKeyId: "test-auth-key-id",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("configureWithWallet", () => {
    it("should configure with default settings", async () => {
      const provider = await PrivySvmWalletProvider.configureWithWallet(MOCK_CONFIG);

      expect(provider).toBeInstanceOf(PrivySvmWalletProvider);
    });

    it("should configure with an existing wallet ID", async () => {
      const provider = await PrivySvmWalletProvider.configureWithWallet(MOCK_CONFIG_WITH_WALLET_ID);

      expect(provider).toBeInstanceOf(PrivySvmWalletProvider);
    });

    it("should configure with a specified network ID", async () => {
      const provider = await PrivySvmWalletProvider.configureWithWallet(
        MOCK_CONFIG_WITH_NETWORK_ID,
      );

      expect(provider).toBeInstanceOf(PrivySvmWalletProvider);
    });

    it("should configure with authorization keys", async () => {
      const provider = await PrivySvmWalletProvider.configureWithWallet(MOCK_CONFIG_WITH_AUTH_KEY);

      expect(provider).toBeInstanceOf(PrivySvmWalletProvider);
    });

    it("should configure with a custom connection", async () => {
      const connection = new Connection("https://custom-rpc.example.com");

      const provider = await PrivySvmWalletProvider.configureWithWallet({
        ...MOCK_CONFIG,
        connection,
      });

      expect(provider).toBeInstanceOf(PrivySvmWalletProvider);
    });

    it("should handle configuration with invalid network", async () => {
      const mockClusterApiUrl = jest.fn().mockImplementation(() => {
        throw new Error("Invalid cluster");
      });

      const webThreeJs = jest.requireMock("@solana/web3.js");
      const originalFn = webThreeJs.clusterApiUrl;
      webThreeJs.clusterApiUrl = mockClusterApiUrl;

      await expect(
        PrivySvmWalletProvider.configureWithWallet({
          ...MOCK_CONFIG,
          networkId: "this-network-definitely-does-not-exist",
        }),
      ).rejects.toThrow();

      webThreeJs.clusterApiUrl = originalFn;
    });
  });

  describe("wallet methods", () => {
    let provider: PrivySvmWalletProvider;
    let mockTransaction: VersionedTransaction;

    beforeEach(async () => {
      provider = await PrivySvmWalletProvider.configureWithWallet(MOCK_CONFIG);
      mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
      } as unknown as VersionedTransaction;
    });

    it("should get the wallet address", () => {
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "solana",
        chainId: "devnet",
        networkId: "devnet",
      });
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("privy_svm_wallet_provider");
    });

    it("should get the wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(BigInt(1000000000));
    });

    it("should sign a transaction", async () => {
      const signedTx = await provider.signTransaction(mockTransaction);
      expect(signedTx).toBe("mock-signed-transaction");
    });

    it("should sign and send a transaction", async () => {
      const hash = await provider.signAndSendTransaction(mockTransaction);
      expect(hash).toBe("mock-hash");
    });

    it("should throw an error when sending a transaction directly", async () => {
      await expect(provider.sendTransaction(mockTransaction)).rejects.toThrow(
        "Method not implemented",
      );
    });

    it("should throw an error when transferring native tokens", async () => {
      await expect(provider.nativeTransfer("destination-address", "1.0")).rejects.toThrow(
        "Method not implemented",
      );
    });

    it("should get the signature status", async () => {
      const status = await provider.getSignatureStatus("mock-signature");

      expect(status).toEqual({
        context: { slot: 123 },
        value: { slot: 123, confirmations: 10, err: null },
      });
    });

    it("should wait for signature result", async () => {
      const result = await provider.waitForSignatureResult("mock-signature");

      expect(result).toEqual({
        context: { slot: 123 },
        value: { err: null },
      });
    });

    it("should get the connection", () => {
      const connection = provider.getConnection();
      expect(connection).toBeDefined();
    });

    it("should get the public key", () => {
      const publicKey = provider.getPublicKey();
      expect(publicKey.toBase58()).toBe(MOCK_ADDRESS);
    });

    it("should export wallet data", () => {
      const walletData = provider.exportWallet();

      expect(walletData).toEqual({
        walletId: "test-wallet-id",
        authorizationPrivateKey: undefined,
        chainId: "devnet",
        networkId: "devnet",
      });
    });

    it("should handle errors when signing transaction", async () => {
      jest.spyOn(provider, "signTransaction").mockRejectedValueOnce(new Error("Signing failed"));

      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
      } as unknown as VersionedTransaction;

      await expect(provider.signTransaction(mockTransaction)).rejects.toThrow("Signing failed");
    });

    it("should handle errors when signing and sending transaction", async () => {
      jest
        .spyOn(provider, "signAndSendTransaction")
        .mockRejectedValueOnce(new Error("Failed to send transaction"));

      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
      } as unknown as VersionedTransaction;

      await expect(provider.signAndSendTransaction(mockTransaction)).rejects.toThrow(
        "Failed to send transaction",
      );
    });

    it("should handle timeout during transaction signature status check", async () => {
      const mockMethod = jest.fn().mockRejectedValueOnce(new Error("Request timed out"));
      const connection = provider.getConnection();
      connection.getSignatureStatus = mockMethod;

      await expect(provider.getSignatureStatus("mock-signature")).rejects.toThrow(
        "Request timed out",
      );
    });

    it("should handle network errors during balance check", async () => {
      const mockMethod = jest.fn().mockRejectedValueOnce(new Error("RPC endpoint error"));
      const connection = provider.getConnection();
      connection.getBalance = mockMethod;

      await expect(provider.getBalance()).rejects.toThrow("RPC endpoint error");
    });
  });
});
