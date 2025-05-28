import { CdpWalletProvider } from "./cdpWalletProvider";
import { Network } from "../network";
import {
  Abi,
  EstimateFeesPerGasReturnType,
  PublicClient,
  ReadContractParameters,
  TransactionReceipt,
  TransactionRequest,
} from "viem";
import {
  Coinbase,
  CreateERC20Options,
  CreateTradeOptions,
  PayloadSignature,
  SmartContract,
  Trade,
  Transfer,
  Wallet,
  WalletAddress,
  WalletData,
} from "@coinbase/coinbase-sdk";
import { Decimal } from "decimal.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

// =========================================================
// consts
// =========================================================

const mockPublicClient = {
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  getTransactionCount: jest.fn(),
  estimateFeesPerGas: jest.fn(),
  estimateGas: jest.fn(),
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
    createWalletClient: jest.fn(),
    http: jest.fn(),
    zeroAddress: "0x0000000000000000000000000000000000000000",
    parseEther: jest.fn((_value: string) => BigInt(1000000000000000000)),
    keccak256: jest.fn((_value: string) => "0xmockhash"),
    serializeTransaction: jest.fn((_tx: string) => "0xserialized"),
    hashMessage: jest.fn((_message: string) => "0xmockhashmessage"),
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

interface WalletAddressModel {
  wallet_id: string;
  network_id: string;
  public_key: string;
  address_id: string;
  index: number;
}

// Mock Coinbase SDK
jest.mock("@coinbase/coinbase-sdk", () => {
  const mockWalletAddressFn = jest.fn();

  mockWalletAddressFn.mockImplementation((model: unknown) => {
    const typedModel = model as WalletAddressModel;
    return {
      address_id: typedModel.address_id,
      wallet_id: typedModel.wallet_id,
      network_id: typedModel.network_id,
      public_key: typedModel.public_key,
      index: typedModel.index,
      getId: jest.fn().mockReturnValue(typedModel.address_id),
    };
  });

  // Create a mock for ExternalAddress
  const mockExternalAddress = jest.fn().mockImplementation(() => {
    return {
      broadcastExternalTransaction: jest.fn().mockImplementation(async () => ({
        transactionHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
      })),
    };
  });

  return {
    Wallet: {
      import: jest.fn(),
      create: jest.fn(),
    },
    Coinbase: {
      assets: {
        Usdc: "USDC",
        Cbbtc: "CBBTC",
        Eurc: "EURC",
        Eth: "ETH",
      },
      configure: jest.fn(),
      configureFromJson: jest.fn(),
      networks: {
        BaseSepolia: "base-sepolia",
      },
    },
    assets: {
      Usdc: "USDC",
      Cbbtc: "CBBTC",
      Eurc: "EURC",
      Eth: "ETH",
    },
    hashTypedDataMessage: jest.fn(),
    hashMessage: jest.fn(),
    WalletAddress: mockWalletAddressFn,
    ExternalAddress: mockExternalAddress,
  };
});

const mockWalletObj = {
  getDefaultAddress: jest.fn(),
  getNetworkId: jest.fn(),
  getBalance: jest.fn(),
  createPayloadSignature: jest.fn(),
  createTransfer: jest.fn(),
  createTrade: jest.fn(),
  deployToken: jest.fn(),
  deployContract: jest.fn(),
  deployNFT: jest.fn(),
  export: jest.fn(),
} as unknown as jest.Mocked<Wallet>;

// =========================================================
// test constants
// =========================================================

const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_NETWORK_ID = "mainnet";
const MOCK_PRIVATE_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";
const MOCK_BALANCE = 1000000000000000000n;
const MOCK_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: MOCK_NETWORK_ID,
};
const MOCK_TRANSACTION_RECEIPT = {
  transactionHash: MOCK_TRANSACTION_HASH,
} as unknown as TransactionReceipt;

describe("CdpWalletProvider", () => {
  let provider: CdpWalletProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockWalletAddress = {
      wallet_id: "mock-wallet-id",
      network_id: MOCK_NETWORK_ID,
      public_key: "mock-public-key",
      address_id: MOCK_ADDRESS,
      index: 0,
      getId: jest.fn().mockReturnValue(MOCK_ADDRESS),
    } as unknown as jest.Mocked<WalletAddress>;

    mockWalletObj.getDefaultAddress.mockResolvedValue(mockWalletAddress);
    mockWalletObj.getNetworkId.mockReturnValue(MOCK_NETWORK_ID);
    mockWalletObj.getBalance.mockResolvedValue(new Decimal(1));

    const mockPayloadSignature = {
      getStatus: jest.fn().mockReturnValue("completed"),
      getSignature: jest.fn().mockReturnValue(MOCK_SIGNATURE),
    } as unknown as jest.Mocked<PayloadSignature>;
    mockWalletObj.createPayloadSignature.mockResolvedValue(mockPayloadSignature);

    const mockTransferResult = {
      getTransactionHash: jest.fn().mockReturnValue(MOCK_TRANSACTION_HASH),
      wait: jest.fn(),
    } as unknown as jest.Mocked<Transfer>;

    mockTransferResult.wait.mockResolvedValue(mockTransferResult);
    mockWalletObj.createTransfer.mockResolvedValue(mockTransferResult);

    mockWalletObj.export.mockReturnValue({
      seed: MOCK_PRIVATE_KEY,
      networkId: MOCK_NETWORK_ID,
    } as WalletData);

    jest.spyOn(Wallet, "import").mockResolvedValue(mockWalletObj);
    jest.spyOn(Wallet, "create").mockResolvedValue(mockWalletObj);

    mockPublicClient.waitForTransactionReceipt.mockResolvedValue(MOCK_TRANSACTION_RECEIPT);
    mockPublicClient.readContract.mockResolvedValue("mock_result" as string);
    mockPublicClient.getTransactionCount.mockResolvedValue(1);
    mockPublicClient.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: BigInt(100000000),
      maxPriorityFeePerGas: BigInt(10000000),
    } as unknown as jest.Mocked<EstimateFeesPerGasReturnType>);
    mockPublicClient.estimateGas.mockResolvedValue(BigInt(21000));

    provider = await CdpWalletProvider.configureWithWallet({
      wallet: mockWalletObj,
      networkId: MOCK_NETWORK_ID,
    });
  });

  // =========================================================
  // initialization tests
  // =========================================================

  describe("initialization", () => {
    it("should initialize with wallet data", async () => {
      const walletData = JSON.stringify({
        seed: MOCK_PRIVATE_KEY,
        networkId: MOCK_NETWORK_ID,
      });

      const provider = await CdpWalletProvider.configureWithWallet({
        cdpWalletData: walletData,
        networkId: MOCK_NETWORK_ID,
      });

      expect(Wallet.import).toHaveBeenCalled();
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should initialize with mnemonic phrase", async () => {
      const mnemonicPhrase = "test test test test test test test test test test test junk";

      const provider = await CdpWalletProvider.configureWithWallet({
        mnemonicPhrase,
        networkId: MOCK_NETWORK_ID,
      });

      expect(Wallet.import).toHaveBeenCalledWith({ mnemonicPhrase }, MOCK_NETWORK_ID);
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should initialize with API keys", async () => {
      const apiKeyId = "test-key";
      const apiKeySecret = "private-key";

      const provider = await CdpWalletProvider.configureWithWallet({
        apiKeyId,
        apiKeySecret,
        networkId: MOCK_NETWORK_ID,
      });

      expect(Coinbase.configure).toHaveBeenCalledWith({
        apiKeyName: apiKeyId,
        privateKey: apiKeySecret,
        source: "agentkit",
        sourceVersion: "1.0.0",
      });

      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should initialize with an existing wallet", async () => {
      const provider = await CdpWalletProvider.configureWithWallet({
        wallet: mockWalletObj as unknown as Wallet,
        networkId: MOCK_NETWORK_ID,
      });

      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
      expect(provider.getNetwork()).toEqual(MOCK_NETWORK);
    });

    it("should default to base-sepolia if network not provided", async () => {
      mockWalletObj.getNetworkId.mockReturnValueOnce("base-sepolia");

      const provider = await CdpWalletProvider.configureWithWallet({
        wallet: mockWalletObj as unknown as Wallet,
      });

      expect(provider.getNetwork().networkId).toBe("base-sepolia");
    });

    it("should handle initialization failures gracefully", async () => {
      jest.spyOn(Wallet, "create").mockRejectedValueOnce(new Error("Failed to create wallet"));

      await expect(
        CdpWalletProvider.configureWithWallet({
          networkId: MOCK_NETWORK_ID,
        }),
      ).rejects.toThrow("Failed to create wallet");
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
      expect(provider.getName()).toBe("cdp_wallet_provider");
    });

    it("should get the balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(MOCK_BALANCE);
      expect(mockWalletObj.getBalance).toHaveBeenCalled();
    });

    it("should handle connection errors during balance check", async () => {
      mockWalletObj.getBalance.mockRejectedValueOnce(new Error("Network connection error"));

      await expect(provider.getBalance()).rejects.toThrow("Network connection error");
    });

    it("should handle timeout errors during balance check", async () => {
      mockWalletObj.getBalance.mockRejectedValueOnce(new Error("Request timed out"));

      await expect(provider.getBalance()).rejects.toThrow("Request timed out");
    });
  });

  // =========================================================
  // signing operation tests
  // =========================================================

  describe("signing operations", () => {
    it("should sign messages", async () => {
      const signature = await provider.signMessage("Hello, world!");
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
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
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign transactions", async () => {
      const tx = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const signedTx = await provider.signTransaction(tx);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
      expect(signedTx).toBe(MOCK_SIGNATURE);
    });

    it("should handle signing failures", async () => {
      mockWalletObj.createPayloadSignature.mockRejectedValueOnce(new Error("Signing failed"));

      const message = "Hello, world!";

      await expect(provider.signMessage(message)).rejects.toThrow("Signing failed");
    });
  });

  // =========================================================
  // transaction operation tests
  // =========================================================

  describe("transaction operations", () => {
    it("should send transactions", async () => {
      const validSignature = "0x" + "1".repeat(64) + "2".repeat(64) + "01"; // r, s, v format (130 chars + 0x prefix)
      const mockSignature = {
        model: {},
        getId: jest.fn().mockReturnValue("signature-id"),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddressId: jest.fn().mockReturnValue(MOCK_ADDRESS),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getSignature: jest.fn().mockReturnValue(validSignature),
        getPayload: jest.fn().mockReturnValue("0xpayload"),
        getEncodedPayload: jest.fn().mockReturnValue("0xencodedpayload"),
        getStatus: jest.fn().mockReturnValue("completed"),
      } as unknown as jest.Mocked<PayloadSignature>;

      mockWalletObj.createPayloadSignature.mockResolvedValue(mockSignature);

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      const txHash = await provider.sendTransaction(transaction);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should wait for the first transfer before sending another one", async () => {
      const validSignature = "0x" + "1".repeat(64) + "2".repeat(64) + "01"; // r, s, v format (130 chars + 0x prefix)
      const mockSignature = {
        model: {},
        getId: jest.fn().mockReturnValue("signature-id"),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddressId: jest.fn().mockReturnValue(MOCK_ADDRESS),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getSignature: jest.fn().mockReturnValue(validSignature),
        getPayload: jest.fn().mockReturnValue("0xpayload"),
        getEncodedPayload: jest.fn().mockReturnValue("0xencodedpayload"),
        getStatus: jest.fn().mockReturnValue("completed"),
      } as unknown as jest.Mocked<PayloadSignature>;

      mockWalletObj.createPayloadSignature.mockResolvedValue(mockSignature);

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      mockPublicClient.waitForTransactionReceipt.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return MOCK_TRANSACTION_RECEIPT;
      });

      const txHash1 = await provider.sendTransaction(transaction);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalledTimes(1);
      expect(txHash1).toBe(MOCK_TRANSACTION_HASH);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
      const awaitReceiptPromise = mockPublicClient.waitForTransactionReceipt.mock.results[0]
        .value as Promise<jest.Mocked<TransactionReceipt>>;

      const secondTxHashPromise = provider.sendTransaction(transaction);
      const race = Promise.race([awaitReceiptPromise, secondTxHashPromise]);
      expect(await race).toStrictEqual(MOCK_TRANSACTION_RECEIPT);
      expect(await secondTxHashPromise).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should execute a native transfer", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "1.0";

      const txHash = await provider.nativeTransfer(to, value);

      expect(mockWalletObj.createTransfer).toHaveBeenCalledWith({
        assetId: "ETH",
        destination: to,
        amount: new Decimal(1),
        gasless: false,
      });
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle transaction failures during send", async () => {
      mockWalletObj.createPayloadSignature.mockRejectedValueOnce(
        new Error("Transaction signing failed"),
      );

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow(
        "Transaction signing failed",
      );
    });

    it("should handle network errors during transfers", async () => {
      mockWalletObj.createTransfer.mockRejectedValueOnce(new Error("Network connection error"));

      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "1.0";

      await expect(provider.nativeTransfer(to, value)).rejects.toThrow("Network connection error");
    });

    it("should handle receipt timeout errors", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error("Timed out"));

      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

      await expect(provider.waitForTransactionReceipt(hash)).rejects.toThrow("Timed out");
    });

    it("should handle transaction timeout during sending", async () => {
      mockWalletObj.createPayloadSignature.mockRejectedValueOnce(
        new Error("Transaction timed out"),
      );

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Transaction timed out");
    });

    it("should handle receipt waiting timeout with specific error", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(
        new Error("Transaction receipt waiting timed out"),
      );

      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

      await expect(provider.waitForTransactionReceipt(hash)).rejects.toThrow(
        "Transaction receipt waiting timed out",
      );
    });

    it("should handle transaction with invalid address", async () => {
      const mockError = new Error("Invalid address format");
      mockWalletObj.createTransfer.mockRejectedValueOnce(mockError);

      const invalidAddress = "not_a_valid_address";
      const value = "1.0";

      await expect(
        provider.nativeTransfer(invalidAddress as unknown as `0x${string}`, value),
      ).rejects.toThrow("Invalid address format");
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
        args: [MOCK_ADDRESS as `0x${string}`],
      } as unknown as jest.Mocked<ReadContractParameters>);

      expect(result).toBe("mock_result");
      expect(mockPublicClient.readContract).toHaveBeenCalled();
    });

    it("should handle network errors during contract reads", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read error"));

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
        } as unknown as jest.Mocked<ReadContractParameters>),
      ).rejects.toThrow("Contract read error");
    });

    it("should handle invalid ABI format in contract reads", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new TypeError("Invalid ABI format"));

      const invalidAbi = "not_a_valid_abi" as unknown as Abi;

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          abi: invalidAbi,
          functionName: "balanceOf",
          args: [MOCK_ADDRESS as `0x${string}`],
        } as unknown as jest.Mocked<ReadContractParameters>),
      ).rejects.toThrow("Invalid ABI format");
    });

    it("should handle contract execution reverts", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(
        new Error("execution reverted: Insufficient funds"),
      );

      const abi = [
        {
          name: "transfer",
          type: "function",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "success", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ] as const;

      await expect(
        provider.readContract({
          address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          abi,
          functionName: "transfer",
          args: ["0x1234567890123456789012345678901234567890", 1000n],
        } as unknown as jest.Mocked<ReadContractParameters>),
      ).rejects.toThrow("execution reverted: Insufficient funds");
    });
  });

  // =========================================================
  // trading operations
  // =========================================================

  describe("trading operations", () => {
    it("should create a trade", async () => {
      const mockTradeTransaction = {
        isTerminalState: jest.fn().mockReturnValue(true),
        getTransactionHash: jest.fn().mockReturnValue(MOCK_TRANSACTION_HASH),
        getTransactionLink: jest
          .fn()
          .mockReturnValue(`https://etherscan.io/tx/${MOCK_TRANSACTION_HASH}`),
        getStatus: jest.fn().mockReturnValue("completed"),
      };

      const mockTradeResult = {
        model: {},
        getId: jest.fn().mockReturnValue("trade-id"),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getFromAmount: jest.fn().mockReturnValue(new Decimal(1)),
        getToAmount: jest.fn().mockReturnValue(new Decimal(100)),
        getFromAssetId: jest.fn().mockReturnValue("ETH"),
        getToAssetId: jest.fn().mockReturnValue("USDC"),
        getStatus: jest.fn().mockReturnValue("completed"),
        setModel: jest.fn(),
        to_amount: "100",
        transaction: { transaction_hash: MOCK_TRANSACTION_HASH },
        getTransaction: jest.fn().mockReturnValue(mockTradeTransaction),
        getAddressId: jest.fn().mockReturnValue(MOCK_ADDRESS),
        reload: jest.fn(),
        getApproveTransaction: jest.fn(),
        sign: jest.fn(),
        broadcast: jest.fn(),
        wait: jest.fn(),
      } as unknown as jest.Mocked<Trade>;

      mockTradeResult.wait.mockResolvedValue(mockTradeResult);
      mockTradeResult.reload.mockResolvedValue(mockTradeResult);

      mockWalletObj.createTrade.mockResolvedValue(mockTradeResult);

      const options: CreateTradeOptions = {
        fromAssetId: "ETH",
        toAssetId: "USDC",
        amount: new Decimal("1.0"),
      };

      const trade = await provider.createTrade(options);

      expect(mockWalletObj.createTrade).toHaveBeenCalledWith(options);
      expect(trade).toBe(mockTradeResult);
    });

    it("should handle trade creation failures", async () => {
      mockWalletObj.createTrade.mockRejectedValueOnce(new Error("Trade creation failed"));

      const options: CreateTradeOptions = {
        fromAssetId: "ETH",
        toAssetId: "USDC",
        amount: new Decimal("1.0"),
      };

      await expect(provider.createTrade(options)).rejects.toThrow("Trade creation failed");
    });

    it("should handle trade state checking", async () => {
      const mockTradeTransaction = {
        isTerminalState: jest.fn().mockReturnValue(true),
        getTransactionHash: jest.fn().mockReturnValue(MOCK_TRANSACTION_HASH),
        getStatus: jest.fn().mockReturnValue("completed"),
      };

      const mockTradeResult = {
        model: {},
        getId: jest.fn().mockReturnValue("trade-id"),
        getStatus: jest.fn().mockReturnValueOnce("pending").mockReturnValueOnce("completed"),
        getTransaction: jest.fn().mockReturnValue(mockTradeTransaction),
        reload: jest.fn().mockImplementation(() => Promise.resolve(mockTradeResult)),
        wait: jest.fn().mockImplementation(() => Promise.resolve(mockTradeResult)),
      } as unknown as jest.Mocked<Trade>;

      jest.spyOn(mockTradeResult, "reload");
      jest.spyOn(mockTradeResult, "wait");

      mockWalletObj.createTrade.mockResolvedValue(mockTradeResult);

      const options: CreateTradeOptions = {
        fromAssetId: "ETH",
        toAssetId: "USDC",
        amount: new Decimal("1.0"),
      };

      const trade = await provider.createTrade(options);

      await trade.reload();
      await trade.wait();

      expect(mockTradeResult.reload).toHaveBeenCalled();
      expect(mockTradeResult.wait).toHaveBeenCalled();
    });
  });

  // =========================================================
  // token & contract deployment operations
  // =========================================================

  describe("token and contract deployment", () => {
    it("should deploy a token", async () => {
      const mockTokenResult = {
        model: {},
        isExternal: false,
        getId: jest.fn().mockReturnValue("token-id"),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddress: jest.fn().mockReturnValue("0xtoken"),
        address: "0xtoken",
      } as unknown as jest.Mocked<SmartContract>;

      mockWalletObj.deployToken.mockResolvedValue(mockTokenResult);

      const options: CreateERC20Options = {
        name: "Test Token",
        symbol: "TEST",
        totalSupply: new Decimal("1000000"),
      };

      const token = await provider.deployToken(options);

      expect(mockWalletObj.deployToken).toHaveBeenCalledWith(options);
      expect(token).toBe(mockTokenResult);
    });

    it("should handle token deployment failures", async () => {
      mockWalletObj.deployToken.mockRejectedValueOnce(new Error("Token deployment failed"));

      const options: CreateERC20Options = {
        name: "Test Token",
        symbol: "TEST",
        totalSupply: new Decimal("1000000"),
      };

      await expect(provider.deployToken(options)).rejects.toThrow("Token deployment failed");
    });

    it("should deploy a contract", async () => {
      const options = {
        solidityVersion: "0.8.0",
        solidityInputJson: "{}",
        contractName: "TestContract",
        constructorArgs: { _name: "Test" },
      };

      const mockContractResult = {
        model: {},
        isExternal: false,
        getId: jest.fn().mockReturnValue("contract-id"),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddress: jest.fn().mockReturnValue("0xcontract"),
        address: "0xcontract",
      } as unknown as jest.Mocked<SmartContract>;

      mockWalletObj.deployContract.mockResolvedValue(mockContractResult);

      const contract = await provider.deployContract(options);

      expect(mockWalletObj.deployContract).toHaveBeenCalledWith(options);
      expect(contract).toBe(mockContractResult);
    });

    it("should handle contract deployment failures", async () => {
      mockWalletObj.deployContract.mockRejectedValueOnce(new Error("Contract deployment failed"));

      const options = {
        solidityVersion: "0.8.0",
        solidityInputJson: "{}",
        contractName: "TestContract",
        constructorArgs: { _name: "Test" },
      };

      await expect(provider.deployContract(options)).rejects.toThrow("Contract deployment failed");
    });

    it("should deploy an NFT", async () => {
      const options = {
        name: "Test NFT",
        symbol: "TNFT",
        baseURI: "https://example.com/nft/",
      };

      const mockNftResult = {
        model: {},
        isExternal: false,
        getId: jest.fn().mockReturnValue("nft-id"),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddress: jest.fn().mockReturnValue("0xnft"),
        address: "0xnft",
      } as unknown as jest.Mocked<SmartContract>;

      mockWalletObj.deployNFT.mockResolvedValue(mockNftResult);

      const nft = await provider.deployNFT(options);

      expect(mockWalletObj.deployNFT).toHaveBeenCalledWith(options);
      expect(nft).toBe(mockNftResult);
    });

    it("should handle NFT deployment failures", async () => {
      mockWalletObj.deployNFT.mockRejectedValueOnce(new Error("NFT deployment failed"));

      const options = {
        name: "Test NFT",
        symbol: "TNFT",
        baseURI: "https://example.com/nft/",
      };

      await expect(provider.deployNFT(options)).rejects.toThrow("NFT deployment failed");
    });
  });

  // =========================================================
  // transfer operations
  // =========================================================

  describe("transfer operations", () => {
    it("should execute a native transfer", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "1.0";

      const txHash = await provider.nativeTransfer(to, value);

      expect(mockWalletObj.createTransfer).toHaveBeenCalledWith({
        assetId: "ETH",
        destination: to,
        amount: new Decimal(1),
        gasless: false,
      });
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle native transfer failures", async () => {
      mockWalletObj.createTransfer.mockRejectedValueOnce(new Error("Network connection error"));

      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "1.0";

      await expect(provider.nativeTransfer(to, value)).rejects.toThrow("Network connection error");
    });

    it("should execute gasless ERC20 transfer", async () => {
      const destination = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 1000000000n;
      const assetId = "USDC";

      const hash = await provider.gaslessERC20Transfer(assetId, destination, amount);

      expect(hash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockWalletObj.createTransfer).toHaveBeenCalledWith({
        amount,
        assetId,
        destination,
        gasless: true,
      });
    });

    it("should handle gasless ERC20 transfer failures", async () => {
      mockWalletObj.createTransfer.mockRejectedValueOnce(new Error("Gasless transfer failed"));

      const destination = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 1000000000n;
      const assetId = "USDC";

      await expect(provider.gaslessERC20Transfer(assetId, destination, amount)).rejects.toThrow(
        "Gasless transfer failed",
      );
    });

    it("should handle transfer for amounts below minimum", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "0.000000001";

      const hash = await provider.nativeTransfer(to, value);

      expect(hash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockWalletObj.createTransfer).toHaveBeenCalled();
    });
  });

  // =========================================================
  // wallet management
  // =========================================================

  describe("wallet management", () => {
    it("should export wallet data", async () => {
      const data = await provider.exportWallet();

      expect(data).toEqual({
        seed: MOCK_PRIVATE_KEY,
        networkId: MOCK_NETWORK_ID,
      });
      expect(mockWalletObj.export).toHaveBeenCalled();
    });

    it("should handle wallet export failures", async () => {
      mockWalletObj.export.mockImplementationOnce(() => {
        throw new Error("Export failed");
      });

      await expect(provider.exportWallet()).rejects.toThrow("Export failed");
    });

    it("should get wallet network ID", () => {
      expect(provider.getNetwork().networkId).toBe(MOCK_NETWORK_ID);
    });
  });
});
