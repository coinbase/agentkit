import { SolanaKeypairWalletProvider } from "./solanaKeypairWalletProvider";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
  SystemProgram,
  VersionedMessage,
  TransactionMessage
} from "@solana/web3.js";
import {
  SOLANA_DEVNET_GENESIS_BLOCK_HASH,
  SOLANA_MAINNET_GENESIS_BLOCK_HASH,
  SOLANA_NETWORKS,
  SOLANA_TESTNET_GENESIS_BLOCK_HASH,
  SOLANA_NETWORK_ID,
} from "../network/svm";

// Mock @solana/web3.js
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
      // Add sign method to make the mock complete
      signatures: [],
      message: { compiledMessage: Buffer.from([]) },
      sign: jest.fn(function(signers) {
        // Implementation that updates signatures array
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
      // Mock as a simple object with properties instead of instance methods
      compile: jest.fn().mockReturnValue({
        compiledMessage: Buffer.from([]),
      }),
    },
    clusterApiUrl: jest.fn().mockImplementation((network) => `https://api.${network}.solana.com`),
  };
});

describe("SolanaKeypairWalletProvider", () => {
  let wallet: SolanaKeypairWalletProvider;
  
  beforeEach(async () => {
    const keypair = Keypair.generate();
    wallet = await SolanaKeypairWalletProvider.fromRpcUrl("https://api.devnet.solana.com", keypair.secretKey);
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
      
      // Use the exported type directly
      const networkId = "solana-devnet";
      const wallet = await SolanaKeypairWalletProvider.fromNetwork(networkId, keypair.secretKey);
      
      expect(clusterApiUrl).toHaveBeenCalledWith("devnet");
      expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);
    });
    
    it("should initialize from connection", async () => {
      const keypair = Keypair.generate();
      const connection = new Connection("https://api.devnet.solana.com");
      
      const provider = await SolanaKeypairWalletProvider.fromConnection(connection, keypair.secretKey);
      
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
      // Create mock transaction with the sign method
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function(signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;
      
      const signedTx = await wallet.signTransaction(mockTransaction);
      expect(mockTransaction.sign).toHaveBeenCalled();
      expect(signedTx).toBe(mockTransaction);
    });
    
    it("should send a transaction", async () => {
      // Create mock transaction with the sign method
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function(signers) {
          this.signatures = signers.map(() => new Uint8Array(64).fill(1));
          return this;
        }),
      } as unknown as VersionedTransaction;
      
      const signature = await wallet.sendTransaction(mockTransaction);
      expect(signature).toBe("signature123");
    });
    
    it("should sign and send a transaction", async () => {
      // Create mock transaction with the sign method
      const mockTransaction = {
        message: { compiledMessage: Buffer.from([]) },
        signatures: [],
        sign: jest.fn(function(signers) {
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
      // We need to properly mock the classes and methods used in nativeTransfer
      const { SystemProgram, MessageV0, VersionedTransaction } = jest.requireMock("@solana/web3.js");
      
      // Mock the necessary methods and classes for this test
      const mockVersionedTx = new VersionedTransaction(MessageV0.compile());

      // Use the mock methods created earlier to simulate the transaction creation process
      const destination = "EQJqzeeVEnm8rKWQJ5SMTtQBD4xEgixwgzNWKkpeFRZ9";
      const signature = await wallet.nativeTransfer(destination, "0.1");
      
      // Verify the result
      expect(signature).toBe("signature123");
    });
  });
});
