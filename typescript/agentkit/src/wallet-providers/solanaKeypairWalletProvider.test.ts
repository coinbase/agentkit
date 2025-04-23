import { SolanaKeypairWalletProvider } from "./solanaKeypairWalletProvider";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { SOLANA_DEVNET_GENESIS_BLOCK_HASH, SOLANA_NETWORKS } from "../network/svm";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("@solana/web3.js", () => {
  const originalModule = jest.requireActual("@solana/web3.js");
  return {
    ...originalModule,
    Connection: jest.fn().mockImplementation(() => ({
      getGenesisHash: jest.fn().mockResolvedValue(SOLANA_DEVNET_GENESIS_BLOCK_HASH),
      getBalance: jest.fn().mockResolvedValue(1000000000),
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: "test-blockhash",
        lastValidBlockHeight: 123456,
      }),
      sendTransaction: jest.fn().mockResolvedValue("signature123"),
      getSignatureStatus: jest.fn().mockResolvedValue({
        context: { slot: 123 },
        value: { slot: 123, confirmations: 10, err: null },
      }),
      confirmTransaction: jest.fn().mockResolvedValue({
        context: { slot: 123 },
        value: { err: null },
      }),
      requestAirdrop: jest.fn().mockResolvedValue("airdrop-signature"),
    })),
    Keypair: {
      generate: jest.fn().mockReturnValue({
        publicKey: new originalModule.PublicKey("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM"),
        secretKey: new Uint8Array(32).fill(1),
        sign: jest.fn(),
      }),
      fromSecretKey: jest.fn().mockReturnValue({
        publicKey: new originalModule.PublicKey("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM"),
        secretKey: new Uint8Array(32).fill(1),
        sign: jest.fn(),
      }),
    },
    PublicKey: originalModule.PublicKey,
    VersionedTransaction: jest.fn().mockImplementation(() => ({
      signatures: [],
      message: { compiledMessage: Buffer.from([]) },
      sign: jest.fn(function (signers) {
        this.signatures = signers.map(() => new Uint8Array(64).fill(1));
        return this;
      }),
    })),
    SystemProgram: {
      transfer: jest.fn().mockReturnValue({
        instructions: [{ programId: "system-program" }],
      }),
    },
    MessageV0: {
      compile: jest.fn().mockReturnValue({
        compiledMessage: Buffer.from([]),
      }),
    },
    TransactionMessage: {
      compile: jest.fn().mockReturnValue({
        compiledMessage: Buffer.from([]),
      }),
    },
    clusterApiUrl: jest.fn().mockImplementation(network => `https://api.${network}.solana.com`),
  };
});

describe("SolanaKeypairWalletProvider", () => {
  let wallet: SolanaKeypairWalletProvider;

  beforeEach(async () => {
    const keypair = Keypair.generate();
    wallet = await SolanaKeypairWalletProvider.fromRpcUrl(
      "https://api.devnet.solana.com",
      keypair.secretKey,
    );
  });

  describe("initialization methods", () => {
    it("should initialize from constructor", async () => {
      const keypair = Keypair.generate();
      const rpcUrl = "https://api.devnet.solana.com";

      const provider = new SolanaKeypairWalletProvider({
        keypair: keypair.secretKey,
        rpcUrl,
        genesisHash: SOLANA_DEVNET_GENESIS_BLOCK_HASH,
      });

      expect(provider).toBeInstanceOf(SolanaKeypairWalletProvider);
      expect(provider.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });

    it("should initialize from RPC URL", async () => {
      const keypair = Keypair.generate();
      const rpcUrl = "https://api.devnet.solana.com";

      const provider = await SolanaKeypairWalletProvider.fromRpcUrl(rpcUrl, keypair.secretKey);

      expect(provider).toBeInstanceOf(SolanaKeypairWalletProvider);
      expect(provider.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });

    it("should initialize from network ID", async () => {
      const keypair = Keypair.generate();

      const networkId = "solana-devnet";
      const wallet = await SolanaKeypairWalletProvider.fromNetwork(networkId, keypair.secretKey);

      expect(clusterApiUrl).toHaveBeenCalledWith("devnet");
      expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });

    it("should initialize from connection", async () => {
      const keypair = Keypair.generate();
      const connection = new Connection("https://api.devnet.solana.com");

      const provider = await SolanaKeypairWalletProvider.fromConnection(
        connection,
        keypair.secretKey,
      );

      expect(provider).toBeInstanceOf(SolanaKeypairWalletProvider);
      expect(provider.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });
  });

  describe("wallet methods", () => {
    it("should get the address", () => {
      expect(wallet.getAddress()).toBe("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM");
    });

    it("should get the public key", () => {
      const publicKey = wallet.getPublicKey();
      expect(publicKey).toBeInstanceOf(PublicKey);
      expect(publicKey.toBase58()).toBe("AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM");
    });

    it("should get the network", () => {
      expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });

    it("should get the connection", () => {
      expect(wallet.getConnection()).toBeDefined();
    });

    it("should get the balance", async () => {
      const balance = await wallet.getBalance();
      expect(balance).toBe(BigInt(1000000000));
    });

    it("should sign a transaction", async () => {
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function (signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;

      const signedTx = await wallet.signTransaction(mockTransaction);
      expect(mockTransaction.sign).toHaveBeenCalled();
      expect(signedTx).toBe(mockTransaction);
    });

    it("should send a transaction", async () => {
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function (signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;

      const signature = await wallet.sendTransaction(mockTransaction);
      expect(signature).toBe("signature123");
    });

    it("should sign and send a transaction", async () => {
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function (signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;

      const signature = await wallet.signAndSendTransaction(mockTransaction);
      expect(mockTransaction.sign).toHaveBeenCalled();
      expect(signature).toBe("signature123");
    });

    it("should get the signature status", async () => {
      const status = await wallet.getSignatureStatus("signature123");
      expect(status.value).toHaveProperty("slot");
      expect(status.value).toHaveProperty("confirmations");
    });

    it("should wait for signature result", async () => {
      const result = await wallet.waitForSignatureResult("signature123");
      expect(result.value).toHaveProperty("err");
    });

    it("should request an airdrop", async () => {
      const signature = await wallet.requestAirdrop(1000000000);
      expect(signature).toBe("airdrop-signature");
    });

    it("should transfer native tokens", async () => {
      const destination = "EQJqzeeVEnm8rKWQJ5SMTtQBD4xEgixwgzNWKkpeFRZ9";
      const signature = await wallet.nativeTransfer(destination, "0.1");

      expect(signature).toBe("signature123");
    });

    it("should handle insufficient balance when transferring", async () => {
      const connection = wallet.getConnection();
      (connection.getBalance as jest.Mock).mockResolvedValueOnce(100);

      const destination = "EQJqzeeVEnm8rKWQJ5SMTtQBD4xEgixwgzNWKkpeFRZ9";

      await expect(wallet.nativeTransfer(destination, "1.0")).rejects.toThrow(
        "Insufficient balance",
      );
    });

    it("should handle transaction failure when sending", async () => {
      const connection = wallet.getConnection();
      (connection.sendTransaction as jest.Mock).mockRejectedValueOnce(
        new Error("Transaction failed"),
      );

      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function (signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;

      await expect(wallet.sendTransaction(mockTransaction)).rejects.toThrow("Transaction failed");
    });

    it("should handle confirmation timeout", async () => {
      const connection = wallet.getConnection();
      (connection.confirmTransaction as jest.Mock).mockRejectedValueOnce(
        new Error("Timed out waiting for confirmation"),
      );

      await expect(wallet.waitForSignatureResult("signature123")).rejects.toThrow(
        "Timed out waiting for confirmation",
      );
    });

    it("should handle invalid address when transferring", async () => {
      const destination = "invalid-address";

      await expect(wallet.nativeTransfer(destination, "0.1")).rejects.toThrow();
    });
  });
});
