import { CdpWalletProvider } from "./cdpWalletProvider";
import { Network } from "../network";
import {
  TransactionRequest,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  zeroAddress,
  Hex,
  Address,
  PublicClient,
  EstimateFeesPerGasReturnType,
} from "viem";
import { 
  Wallet, 
  Coinbase, 
  SmartContract, 
  Trade, 
  CreateERC20Options, 
  CreateTradeOptions,
  Amount,
  PayloadSignature,
  Transfer,
  WalletAddress,
  CreateTransferOptions,
  WalletData,
} from "@coinbase/coinbase-sdk";
import { Decimal } from "decimal.js";
import { jest } from "@jest/globals";

// Mock modules before imports
jest.mock("../../package.json", () => ({
  version: "1.0.0",
}));

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

// Create mock objects
const mockPublicClient = {
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  getTransactionCount: jest.fn(),
  estimateFeesPerGas: jest.fn(),
  estimateGas: jest.fn(),
} as unknown as jest.Mocked<PublicClient>;

// Mock viem module
jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn(() => mockPublicClient),
    createWalletClient: jest.fn(),
    http: jest.fn(),
    zeroAddress: "0x0000000000000000000000000000000000000000",
    parseEther: jest.fn((value: string) => BigInt(1000000000000000000)),
    keccak256: jest.fn((value: string) => "0xmockhash"),
    serializeTransaction: jest.fn((tx: any) => "0xserialized"),
  };
});

// Mock the NETWORK_ID_TO_CHAIN_ID mapping
jest.mock("../network", () => {
  return {
    NETWORK_ID_TO_CHAIN_ID: {
      "mainnet": "1",
      "base-sepolia": "84532",
    }
  };
});

// Adding an interface for the WalletAddress model
interface WalletAddressModel {
  wallet_id: string;
  network_id: string;
  public_key: string;
  address_id: string;
  index: number;
}

// Mock Coinbase SDK with direct values
jest.mock("@coinbase/coinbase-sdk", () => {
  const mockWalletAddressFn = jest.fn();
  // Use type assertion for the model parameter
  mockWalletAddressFn.mockImplementation((model: unknown) => {
    const typedModel = model as WalletAddressModel;
    return {
      address_id: typedModel.address_id,
      wallet_id: typedModel.wallet_id,
      network_id: typedModel.network_id,
      public_key: typedModel.public_key,
      index: typedModel.index,
      // Add getId method that returns the address_id
      getId: jest.fn().mockReturnValue(typedModel.address_id)
    };
  });
  
  // Create a mock for ExternalAddress
  const mockExternalAddress = jest.fn().mockImplementation(() => {
    return {
      broadcastExternalTransaction: jest.fn().mockImplementation(async () => ({
        transactionHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
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

// Create a wallet mock object with proper types
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
  createAddress: jest.fn(),
  setSeed: jest.fn(),
  getAddress: jest.fn(),
  listAddresses: jest.fn(),
  listBalances: jest.fn(),
  getBalances: jest.fn(),
  getBalanceMap: jest.fn(),
  createFaucetTransaction: jest.fn(),
  getFaucetTransaction: jest.fn(),
  listFaucetTransactions: jest.fn(),
  getTransfer: jest.fn(),
  listTransfers: jest.fn(),
  getTrade: jest.fn(),
  listTrades: jest.fn(),
  getStakingOperation: jest.fn(),
  listStakingOperations: jest.fn(),
  getStakingRewards: jest.fn(),
  getHistoricalStakingBalances: jest.fn(),
  getStakingBalances: jest.fn(),
  getPayloadSignature: jest.fn(),
  listPayloadSignatures: jest.fn(),
  getContractInvocation: jest.fn(),
  listContractInvocations: jest.fn(),
  getSmartContract: jest.fn(),
  listSmartContracts: jest.fn(),
  getFundOperation: jest.fn(),
  listFundOperations: jest.fn(),
  getFundQuote: jest.fn(),
  toString: jest.fn(),
} as unknown as jest.Mocked<Wallet>;

describe("CdpWalletProvider", () => {
  const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const MOCK_CHAIN_ID = "1";
  const MOCK_NETWORK_ID = "mainnet";
  const MOCK_PRIVATE_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
  const MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b01";
  const MOCK_BALANCE = 1000000000000000000n; // 1 ETH
  
  // Define MOCK_NETWORK
  const MOCK_NETWORK: Network = {
    protocolFamily: "evm",
    networkId: MOCK_NETWORK_ID,
  };
  
  let provider: CdpWalletProvider;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create mock address model
    const mockAddressModel = {
      wallet_id: "mock-wallet-id",
      network_id: MOCK_NETWORK_ID,
      public_key: "mock-public-key",
      address_id: MOCK_ADDRESS,
      index: 0
    };

    // Create mock wallet address - fix the mocking approach
    const mockWalletAddress = {
      wallet_id: "mock-wallet-id",
      network_id: MOCK_NETWORK_ID,
      public_key: "mock-public-key",
      address_id: MOCK_ADDRESS,
      index: 0,
      getId: jest.fn().mockReturnValue(MOCK_ADDRESS)
    } as unknown as jest.Mocked<WalletAddress>;
    // new WalletAddress(mockAddressModel);
    
    mockWalletObj.getDefaultAddress.mockResolvedValue(mockWalletAddress);
    mockWalletObj.getNetworkId.mockReturnValue(MOCK_NETWORK_ID);
    mockWalletObj.getBalance.mockResolvedValue(new Decimal(1));
    
    // Create mockPayloadSignature with the correct format
    const mockPayloadSignature = {
      getStatus: jest.fn().mockReturnValue("completed"),
      getSignature: jest.fn().mockReturnValue(MOCK_SIGNATURE),
    } as unknown as jest.Mocked<PayloadSignature>;
    mockWalletObj.createPayloadSignature.mockResolvedValue(mockPayloadSignature);
    
    const mockTransferResult = {
      getTransactionHash: jest.fn().mockReturnValue(MOCK_TRANSACTION_HASH),
      wait: jest.fn(),
    } as unknown as jest.Mocked<Transfer>;
    
    // Set up circular reference
    mockTransferResult.wait.mockResolvedValue(mockTransferResult);
    mockWalletObj.createTransfer.mockResolvedValue(mockTransferResult);
    
    mockWalletObj.export.mockReturnValue({ 
      seed: MOCK_PRIVATE_KEY,
      networkId: MOCK_NETWORK_ID,
    } as WalletData);
    
    // Mock the Wallet static methods
    jest.spyOn(Wallet, 'import').mockResolvedValue(mockWalletObj);
    jest.spyOn(Wallet, 'create').mockResolvedValue(mockWalletObj);
    
    // Set up mockPublicClient methods
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: MOCK_TRANSACTION_HASH 
    } as any);
    mockPublicClient.readContract.mockResolvedValue("mock_result" as any);
    mockPublicClient.getTransactionCount.mockResolvedValue(1);
    mockPublicClient.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: BigInt(100000000),
      maxPriorityFeePerGas: BigInt(10000000),
    } as unknown as jest.Mocked<EstimateFeesPerGasReturnType>);
    mockPublicClient.estimateGas.mockResolvedValue(BigInt(21000));

    // Initialize provider
    provider = await CdpWalletProvider.configureWithWallet({
      wallet: mockWalletObj,
      networkId: MOCK_NETWORK_ID,
    });
  });
  
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
      // if this is not successful, then we need to look at the configure with wallet fn
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
      const apiKeyName = "test-key";
      const apiKeyPrivateKey = "private-key";
      
      const provider = await CdpWalletProvider.configureWithWallet({
        apiKeyName,
        apiKeyPrivateKey,
        networkId: MOCK_NETWORK_ID,
      });
      
      expect(Coinbase.configure).toHaveBeenCalledWith({
        apiKeyName,
        privateKey: apiKeyPrivateKey,
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
  });
  
  describe("wallet methods", () => {
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
    
    it("should sign messages", async () => {
      const message = "Hello, world!";
      const signature = await provider.signMessage(message);
      
      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
    });
    
    it("should sign typed data", async () => {
      const typedData = {
        domain: { name: "Test" },
        types: { Test: [{ name: "test", type: "string" }] },
        primaryType: "Test",
        message: { test: "test" },
      };
      
      const signature = await provider.signTypedData(typedData);
      
      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
    });
    
    it("should sign transactions", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: 1000000000000000000n,
      };
      
      const signature = await provider.signTransaction(transaction);
      
      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockWalletObj.createPayloadSignature).toHaveBeenCalled();
    });
    
    it("should send transactions", async () => {
      // For this test, create a mock signature that has the expected format
      // r (32 bytes) + s (32 bytes) + v (1 byte)
      const mockRValue = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const mockSValue = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const mockVValue = "1b"; // Recovery byte
      
      // Override the mock signature just for this test
      const mockSignature = {
        getStatus: jest.fn().mockReturnValue("completed"),
        getSignature: jest.fn().mockReturnValue(`0x${mockRValue}${mockSValue}${mockVValue}`),
      } as unknown as jest.Mocked<PayloadSignature>;
      mockWalletObj.createPayloadSignature.mockResolvedValueOnce(mockSignature);
      
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: 1000000000000000000n,
      };
      
      const hash = await provider.sendTransaction(transaction);
      
      expect(hash).toBe(MOCK_TRANSACTION_HASH);
    });
    
    it("should wait for transaction receipt", async () => {
      const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const receipt = await provider.waitForTransactionReceipt(hash);
      
      expect(receipt).toEqual({ transactionHash: MOCK_TRANSACTION_HASH });
    });
    
    it("should create a trade", async () => {
      const mockTradeTransaction = {
        isTerminalState: jest.fn().mockReturnValue(true),
        getTransactionHash: jest.fn().mockReturnValue(MOCK_TRANSACTION_HASH),
        getTransactionLink: jest.fn().mockReturnValue(`https://etherscan.io/tx/${MOCK_TRANSACTION_HASH}`),
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
      
      // Set up circular reference
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
    
    it("should deploy a token", async () => {
      const mockTokenResult = {
        model: {},
        isExternal: false,
        getId: jest.fn().mockReturnValue("token-id"),
        getNetworkId: jest.fn().mockReturnValue(MOCK_NETWORK_ID),
        getWalletId: jest.fn().mockReturnValue("mock-wallet-id"),
        getAddress: jest.fn().mockReturnValue("0xtoken"),
        address: "0xtoken"
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
        address: "0xcontract"
      } as unknown as jest.Mocked<SmartContract>;
      
      mockWalletObj.deployContract.mockResolvedValue(mockContractResult);
      
      const contract = await provider.deployContract(options);
      
      expect(mockWalletObj.deployContract).toHaveBeenCalledWith(options);
      expect(contract).toBe(mockContractResult);
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
        address: "0xnft"
      } as unknown as jest.Mocked<SmartContract>;
      
      mockWalletObj.deployNFT.mockResolvedValue(mockNftResult);
      
      const nft = await provider.deployNFT(options);
      
      expect(mockWalletObj.deployNFT).toHaveBeenCalledWith(options);
      expect(nft).toBe(mockNftResult);
    });
    
    it("should execute a native transfer", async () => {
      const to = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const value = "1.0";
      
      const hash = await provider.nativeTransfer(to, value);
      
      expect(hash).toBe(MOCK_TRANSACTION_HASH);
      expect(mockWalletObj.createTransfer).toHaveBeenCalledWith(expect.objectContaining({
        amount: expect.any(Decimal),
        assetId: "ETH",
        destination: to,
        gasless: false,
      }));
    });
    
    it("should export wallet data", async () => {
      const data = await provider.exportWallet();
      
      expect(data).toEqual({
        seed: MOCK_PRIVATE_KEY,
        networkId: MOCK_NETWORK_ID,
      });
    });
    
    it("should execute gasless ERC20 transfer", async () => {
      const destination = "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 1000000000n; // Using bigint instead of Decimal
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
  });
});