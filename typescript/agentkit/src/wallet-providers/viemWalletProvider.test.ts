import { ViemWalletProvider } from "./viemWalletProvider";
import {
  TransactionRequest,
  Address,
  Hex,
  Chain,
  ReadContractParameters,
  PublicClient,
  WalletClient,
  Transport,
  PublicActions,
  WalletActions,
} from "viem";
import { jest } from "@jest/globals";

// Define constants first
const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_CHAIN_ID = 1;
const MOCK_NETWORK_ID = "mainnet";
const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
const MOCK_SIGNATURE = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const MOCK_MESSAGE = "Hello, World!";
const MOCK_TYPED_DATA = {
  domain: {
    name: "Example App",
    version: "1",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  },
  types: {
    Person: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
    ],
  },
  primaryType: "Person",
  message: {
    name: "John Doe",
    wallet: "0x0000000000000000000000000000000000000000",
  },
};

// Define a mock chain to use consistently
const MOCK_CHAIN: Chain = {
  id: MOCK_CHAIN_ID,
  name: "Ethereum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://ethereum.example.com"] },
  },
};

// Define proper types for our mock clients
type MockPublicClient = jest.Mocked<PublicClient<Transport, Chain>>;
type MockWalletClient = jest.Mocked<WalletClient<Transport, Chain>>;

// Mock analytics first
jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

// Mock the network module
jest.mock("../network/network", () => ({
  CHAIN_ID_TO_NETWORK_ID: {
    1: "mainnet",
    5: "goerli",
    11155111: "sepolia",
  },
}));

// Mock viem with proper typing
jest.mock("viem", () => {
  const mockPublicClient = {
    getChainId: jest.fn().mockImplementation(() => Promise.resolve(1)),
    getBalance: jest.fn().mockImplementation(() => Promise.resolve(BigInt(1000000000000000000))),
    estimateFeesPerGas: jest.fn().mockImplementation(() => Promise.resolve({
      maxFeePerGas: BigInt(100000000),
      maxPriorityFeePerGas: BigInt(10000000),
    })),
    estimateGas: jest.fn().mockImplementation(() => Promise.resolve(BigInt(21000))),
    waitForTransactionReceipt: jest.fn().mockImplementation(() => Promise.resolve({ 
      transactionHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba" 
    })),
    readContract: jest.fn().mockImplementation(() => Promise.resolve("mock_result")),
    request: jest.fn(),
    extend: jest.fn(),
    chain: MOCK_CHAIN,
    transport: { 
      type: "http",
      key: "test",
      name: "test",
      request: jest.fn(),
    },
    name: "Mock Public Client",
    account: undefined,
    batch: undefined,
    cacheTime: 0,
    ccipRead: false,
    multicall: false,
    pollingInterval: 0,
    retryCount: 0,
    retryDelay: 0,
    timeout: 0,
  } as unknown as jest.Mocked<PublicClient<Transport, Chain>>;

  const mockWalletClient = {
    account: {
      address: MOCK_ADDRESS as Address,
      type: "json-rpc",
    },
    chain: MOCK_CHAIN as Chain,
    signMessage: jest.fn().mockImplementation(() => Promise.resolve(MOCK_SIGNATURE as Hex)),
    signTypedData: jest.fn().mockImplementation(() => Promise.resolve(MOCK_SIGNATURE as Hex)),
    signTransaction: jest.fn().mockImplementation(() => Promise.resolve(MOCK_SIGNATURE as Hex)),
    sendTransaction: jest.fn().mockImplementation(() => Promise.resolve(MOCK_TRANSACTION_HASH as Hex)),
    getAddresses: jest.fn().mockImplementation(() => Promise.resolve([MOCK_ADDRESS as Address])),
    request: jest.fn(),
    extend: jest.fn(),
    transport: { 
      type: "http",
      key: "test",
      name: "test",
      request: jest.fn(),
    },
    name: "Mock Wallet Client",
    batch: undefined,
    cacheTime: 0,
    ccipRead: false,
    multicall: false,
    pollingInterval: 0,
    retryCount: 0,
    retryDelay: 0,
    timeout: 0,
  } as unknown as jest.Mocked<WalletClient<Transport, Chain>>;

  return {
    __esModule: true,
    createPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    createWalletClient: jest.fn().mockReturnValue(mockWalletClient),
    http: jest.fn(),
    parseEther: jest.fn().mockImplementation(() => BigInt(1000000000000000000)),
  };
});

describe("ViemWalletProvider", () => {
  let provider: ViemWalletProvider;
  let mockWalletClient: MockWalletClient;
  let mockPublicClient: MockPublicClient;
  let createPublicClient: jest.Mock;
  let createWalletClient: jest.Mock;
  let parseEther: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Import mocks with proper typing
    const viemModule = require('viem');
    createPublicClient = viemModule.createPublicClient;
    createWalletClient = viemModule.createWalletClient;
    parseEther = viemModule.parseEther;
    
    // Use the mock clients with proper typing
    mockWalletClient = createWalletClient() as MockWalletClient;
    mockPublicClient = createPublicClient() as MockPublicClient;
    
    // Create a new provider instance for each test
    provider = new ViemWalletProvider(mockWalletClient);

    // Wait for trackInitialization to complete
    return new Promise(resolve => setTimeout(resolve, 0));
  });

  describe("constructor", () => {
    it("should create a provider with default gas multipliers", () => {
      const provider = new ViemWalletProvider(mockWalletClient);
      expect(provider).toBeInstanceOf(ViemWalletProvider);
      expect(createPublicClient).toHaveBeenCalledWith({
        chain: MOCK_CHAIN,
        transport: expect.any(Function),
      });
    });

    it("should create a provider with custom gas multipliers", () => {
      const gasConfig = {
        gasLimitMultiplier: 1.5,
        feePerGasMultiplier: 1.2,
      };
      const provider = new ViemWalletProvider(mockWalletClient, gasConfig);
      expect(provider).toBeInstanceOf(ViemWalletProvider);
    });
  });

  describe("wallet methods", () => {
    it("should sign a message", async () => {
      const signature = await provider.signMessage(MOCK_MESSAGE);
      expect(mockWalletClient.signMessage).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        message: MOCK_MESSAGE,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should throw an error when signing a message with no account", async () => {
      // Temporarily set account to undefined
      const originalAccount = mockWalletClient.account;
      mockWalletClient.account = undefined;

      await expect(provider.signMessage(MOCK_MESSAGE)).rejects.toThrow("Account not found");

      // Restore account
      mockWalletClient.account = originalAccount;
    });

    it("should sign typed data", async () => {
      const signature = await provider.signTypedData(MOCK_TYPED_DATA);
      expect(mockWalletClient.signTypedData).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        domain: MOCK_TYPED_DATA.domain,
        types: MOCK_TYPED_DATA.types,
        primaryType: MOCK_TYPED_DATA.primaryType,
        message: MOCK_TYPED_DATA.message,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign a transaction", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
        data: "0xabcdef" as Hex,
      };

      const signature = await provider.signTransaction(transaction);
      expect(mockWalletClient.signTransaction).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        chain: MOCK_CHAIN,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should send a transaction", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
        data: "0xabcdef" as Hex,
      };

      const txHash = await provider.sendTransaction(transaction);
      expect(mockPublicClient.estimateFeesPerGas).toHaveBeenCalled();
      expect(mockPublicClient.estimateGas).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      });
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({
        account: mockWalletClient.account,
        chain: MOCK_CHAIN,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        gas: expect.any(BigInt),
        maxFeePerGas: expect.any(BigInt),
        maxPriorityFeePerGas: expect.any(BigInt),
      }));
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should throw an error when sending a transaction with no account", async () => {
      // Temporarily set account to undefined
      const originalAccount = mockWalletClient.account;
      mockWalletClient.account = undefined;

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Account not found");

      // Restore account
      mockWalletClient.account = originalAccount;
    });

    it("should throw an error when sending a transaction with no chain", async () => {
      // Temporarily set chain to undefined
      const originalChain = mockWalletClient.chain;
      (mockWalletClient as { chain: Chain | undefined }).chain = undefined;

      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Chain not found");

      // Restore chain
      (mockWalletClient as { chain: Chain | undefined }).chain = originalChain;
    });

    it("should get the wallet address", () => {
      const address = provider.getAddress();
      expect(address).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      const network = provider.getNetwork();
      expect(network).toEqual({
        protocolFamily: "evm",
        chainId: MOCK_CHAIN_ID.toString(),
        networkId: MOCK_NETWORK_ID,
      });
    });

    it("should get the provider name", () => {
      const name = provider.getName();
      expect(name).toBe("viem_wallet_provider");
    });

    it("should get the wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({ address: MOCK_ADDRESS });
      expect(balance).toBe(BigInt(1000000000000000000));
    });

    it("should throw an error when getting balance with no account", async () => {
      // Temporarily set account to undefined
      const originalAccount = mockWalletClient.account;
      mockWalletClient.account = undefined;

      await expect(provider.getBalance()).rejects.toThrow("Account not found");

      // Restore account
      mockWalletClient.account = originalAccount;
    });

    it("should wait for a transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex);
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ 
        hash: MOCK_TRANSACTION_HASH 
      });
      expect(receipt).toEqual({ 
        transactionHash: MOCK_TRANSACTION_HASH 
      });
    });

    it("should read contract data", async () => {
      const abi = [{ 
        name: "balanceOf", 
        type: "function", 
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view"
      }] as const;

      const params: ReadContractParameters = {
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS]
      };

      const result = await provider.readContract(params);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith(params);
      expect(result).toBe("mock_result");
    });

    it("should transfer native tokens", async () => {
      const to = "0x1234567890123456789012345678901234567890" as Address;
      const value = "1.0";

      parseEther.mockReturnValue(BigInt(1000000000000000000));

      const txHash = await provider.nativeTransfer(to, value);
      
      expect(parseEther).toHaveBeenCalledWith(value);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled();
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });
  });
}); 