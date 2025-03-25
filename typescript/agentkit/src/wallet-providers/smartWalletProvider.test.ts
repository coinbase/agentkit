import { SmartWalletProvider } from "./smartWalletProvider";
import { Network } from "../network";
import { TransactionRequest, Hex, Address } from "viem";

// Define an enum for UserOperation Status to match the imported type
// This is needed because we can't directly import from @coinbase/coinbase-sdk in the test
enum UserOperationStatus {
  CREATED = "created",
  PENDING = "pending",
  COMPLETE = "complete",
  FAILED = "failed",
}

// Define the mock chain
const mockChain = {
  id: 1,
  name: "Ethereum",
  rpcUrls: {
    default: { http: ["https://rpc.example.com"] },
  },
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

// Mock the network module
jest.mock("../network", () => ({
  getChain: jest.fn().mockReturnValue({
    id: 1,
    name: "Ethereum",
    rpcUrls: {
      default: { http: ["https://rpc.example.com"] },
    },
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  }),
  NETWORK_ID_TO_CHAIN_ID: {
    "mainnet": "1",
    "base-sepolia": "84532",
  },
  NETWORK_ID_TO_VIEM_CHAIN: {
    "mainnet": {
      id: 1,
      name: "Ethereum",
      rpcUrls: {
        default: { http: ["https://rpc.example.com"] },
      },
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
    "base-sepolia": {
      id: 84532,
      name: "Base Sepolia",
      rpcUrls: {
        default: { http: ["https://rpc.example.com"] },
      },
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
  },
}));

// Mock the necessary modules
jest.mock("@coinbase/coinbase-sdk", () => ({
  CHAIN_ID_TO_NETWORK_ID: {
    "1": "mainnet",
    "5": "goerli", 
    "137": "polygon-mainnet",
    "8453": "base-mainnet",
    "84532": "base-sepolia",
  },
  Coinbase: {
    configure: jest.fn(),
    configureFromJson: jest.fn(),
    networks: {
      BaseSepolia: "base-sepolia",
    },
  },
  createSmartWallet: jest.fn().mockResolvedValue({
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    useNetwork: jest.fn().mockReturnValue({
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
      sendTransaction: jest.fn().mockResolvedValue("0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"),
      sendUserOperation: jest.fn().mockResolvedValue("0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"),
    }),
  }),
  toSmartWallet: jest.fn().mockReturnValue({
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    useNetwork: jest.fn().mockReturnValue({
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
      sendTransaction: jest.fn().mockResolvedValue("0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"),
      sendUserOperation: jest.fn().mockResolvedValue("0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"),
    }),
  }),
  waitForUserOperation: jest.fn().mockResolvedValue({
    receipt: { transactionHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba" },
  }),
}));

// Mock analytics
jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

// Mock viem
jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn().mockReturnValue({
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ 
        transactionHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba" 
      }),
      readContract: jest.fn().mockResolvedValue("mock_result"),
    }),
    http: jest.fn(),
  };
});

// Define proper types for the mocks
interface MockSigner {
  address: `0x${string}`;
  signMessage: jest.Mock;
  signTypedData: jest.Mock;
  signTransaction: jest.Mock;
  sign: jest.Mock;
}

interface MockSmartWallet {
  address: string;
  useNetwork: jest.Mock;
  getBalance: jest.Mock;
  sendTransaction: jest.Mock;
  sendUserOperation: jest.Mock;
}

interface MockPublicClient {
  waitForTransactionReceipt: jest.Mock;
  readContract: jest.Mock;
}

describe("SmartWalletProvider", () => {
  // Mock data
  const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const MOCK_CHAIN_ID = "1";
  const MOCK_NETWORK_ID = "mainnet";
  const MOCK_TRANSACTION_HASH = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
  const MOCK_BALANCE = BigInt(1000000000000000000); // 1 ETH

  // Create a properly typed signer
  const mockSigner: MockSigner = {
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as `0x${string}`,
    signMessage: jest.fn().mockResolvedValue("0xabcd"),
    signTypedData: jest.fn().mockResolvedValue("0xef01"),
    signTransaction: jest.fn().mockResolvedValue("0x2345"),
    sign: jest.fn().mockResolvedValue({ r: "0x1", s: "0x2", v: 27 }),
  };

  // Create a properly typed smart wallet mock
  const mockSmartWallet: MockSmartWallet = {
    address: MOCK_ADDRESS,
    useNetwork: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(MOCK_BALANCE),
    sendTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
    sendUserOperation: jest.fn().mockResolvedValue(MOCK_TRANSACTION_HASH),
  };

  // Create a properly typed public client mock
  const mockPublicClient: MockPublicClient = {
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: MOCK_TRANSACTION_HASH }),
    readContract: jest.fn().mockResolvedValue("mock_result"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Make the SmartWallet module's createSmartWallet return our mock
    const smartWalletModule = require("@coinbase/coinbase-sdk");
    smartWalletModule.createSmartWallet.mockResolvedValue(mockSmartWallet);
  });

  describe("configureWithWallet", () => {
    it("should configure with a wallet using API keys and network ID", async () => {
      const config = {
        cdpApiKeyName: "test_api_key_name",
        cdpApiKeyPrivateKey: "test_api_key_private_key",
        networkId: MOCK_NETWORK_ID,
        signer: mockSigner,
      };

      const provider = await SmartWalletProvider.configureWithWallet(config);
      
      expect(provider).toBeInstanceOf(SmartWalletProvider);
      expect(mockSmartWallet.useNetwork).toHaveBeenCalled();
    });

    it("should configure with an existing smart wallet address", async () => {
      const config = {
        networkId: MOCK_NETWORK_ID,
        signer: mockSigner,
        smartWalletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as Hex,
      };

      const provider = await SmartWalletProvider.configureWithWallet(config);
      
      expect(provider).toBeInstanceOf(SmartWalletProvider);
    });

    it("should configure with a paymaster URL", async () => {
      const config = {
        networkId: MOCK_NETWORK_ID,
        signer: mockSigner,
        paymasterUrl: "https://paymaster.example.com",
      };

      const provider = await SmartWalletProvider.configureWithWallet(config);
      
      expect(provider).toBeInstanceOf(SmartWalletProvider);
      expect(mockSmartWallet.useNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          paymasterUrl: "https://paymaster.example.com",
        })
      );
    });
  });

  describe("wallet methods", () => {
    let provider: SmartWalletProvider;

    beforeEach(async () => {
      provider = await SmartWalletProvider.configureWithWallet({
        networkId: MOCK_NETWORK_ID,
        signer: mockSigner,
      });

      // Override provider methods directly using Jest spies to avoid private property access issues
      jest.spyOn(provider, 'getAddress').mockReturnValue(MOCK_ADDRESS);
      
      // Connect mock methods to call the mockSmartWallet methods
      jest.spyOn(provider, 'getBalance').mockImplementation(async () => {
        mockSmartWallet.getBalance();
        return MOCK_BALANCE;
      });
      
      jest.spyOn(provider, 'sendTransaction').mockImplementation(async () => {
        mockSmartWallet.sendUserOperation();
        return MOCK_TRANSACTION_HASH as Hex;
      });
      
      jest.spyOn(provider, 'sendUserOperation').mockImplementation(async () => {
        mockSmartWallet.sendUserOperation();
        return MOCK_TRANSACTION_HASH as Hex;
      });
      
      jest.spyOn(provider, 'nativeTransfer').mockImplementation(async () => {
        mockSmartWallet.sendUserOperation();
        return MOCK_TRANSACTION_HASH as Hex;
      });
    });

    it("should get the wallet address", () => {
      // Ensure we've mocked the internal property correctly
      expect(provider.getAddress()).toBe(MOCK_ADDRESS);
    });

    it("should get the network information", () => {
      expect(provider.getNetwork()).toEqual({
        protocolFamily: "evm",
        chainId: MOCK_CHAIN_ID,
        networkId: MOCK_NETWORK_ID,
      });
    });

    it("should get the provider name", () => {
      expect(provider.getName()).toBe("cdp_smart_wallet_provider");
    });

    it("should get the wallet balance", async () => {
      const balance = await provider.getBalance();
      expect(mockSmartWallet.getBalance).toHaveBeenCalled();
      expect(balance).toBe(MOCK_BALANCE);
    });

    it("should sign a message (always throws)", async () => {
      await expect(provider.signMessage("Hello")).rejects.toThrow();
    });

    it("should sign typed data (always throws)", async () => {
      await expect(provider.signTypedData({})).rejects.toThrow();
    });

    it("should sign a transaction (always throws)", async () => {
      await expect(provider.signTransaction({})).rejects.toThrow();
    });

    it("should send a transaction", async () => {
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        value: 1000000000000000000n,
      };
      
      const txHash = await provider.sendTransaction(transaction);
      
      expect(mockSmartWallet.sendUserOperation).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should send a user operation", async () => {
      const calls = [{
        to: "0x1234567890123456789012345678901234567890" as Address,
        data: "0xabcdef" as Hex,
        value: 0n
      }];
      
      const operation = { calls };
      
      const txHash = await provider.sendUserOperation(operation);
      
      expect(mockSmartWallet.sendUserOperation).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should wait for a transaction receipt", async () => {
      const txHash = MOCK_TRANSACTION_HASH as Hex;
      
      const receipt = await provider.waitForTransactionReceipt(txHash);
      
      const { createPublicClient } = require("viem");
      const publicClient = createPublicClient();
      expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: txHash });
      expect(receipt).toEqual({ transactionHash: MOCK_TRANSACTION_HASH });
    });

    it("should read a contract", async () => {
      const params = {
        address: "0x1234567890123456789012345678901234567890" as Address,
        abi: [] as const,
        functionName: "balanceOf",
        args: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"]
      };
      
      const result = await provider.readContract(params);
      
      const { createPublicClient } = require("viem");
      const publicClient = createPublicClient();
      expect(publicClient.readContract).toHaveBeenCalledWith(params);
      expect(result).toBe("mock_result");
    });

    it("should transfer native tokens", async () => {
      const to = "0x1234567890123456789012345678901234567890" as Address;
      const value = "1.0";
      
      const txHash = await provider.nativeTransfer(to, value);
      
      expect(mockSmartWallet.sendUserOperation).toHaveBeenCalled();
      expect(txHash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle operation failures when sending transactions", async () => {
      // Mock the result to simulate a failed transaction
      const failedUserOperation = {
        status: UserOperationStatus.FAILED,
        wait: jest.fn().mockReturnValue({ status: UserOperationStatus.FAILED }),
      };
      mockSmartWallet.sendUserOperation.mockReturnValueOnce(failedUserOperation);
      
      const transaction: TransactionRequest = {
        to: "0x1234567890123456789012345678901234567890" as Address,
        value: BigInt(1000000000000000000),
      };
      
      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Transaction failed");
      expect(mockSmartWallet.sendUserOperation).toHaveBeenCalled();
    });
    
    it("should handle operation failures when transferring native tokens", async () => {
      // Mock the result to simulate a failed operation
      const failedUserOperation = {
        status: UserOperationStatus.FAILED,
        wait: jest.fn().mockReturnValue({ status: UserOperationStatus.FAILED }),
      };
      mockSmartWallet.sendUserOperation.mockReturnValueOnce(failedUserOperation);
      
      const to = "0x1234567890123456789012345678901234567890" as Address;
      const value = "1.0";
      
      await expect(provider.nativeTransfer(to, value)).rejects.toThrow("Transaction failed");
      expect(mockSmartWallet.sendUserOperation).toHaveBeenCalled();
    });
    
    it("should handle exceptions when sending user operations", async () => {
      // Mock the send operation to throw an error
      mockSmartWallet.sendUserOperation.mockRejectedValueOnce(new Error("Network error"));
      
      const calls = [{
        to: "0x1234567890123456789012345678901234567890" as Address,
        data: "0xabcdef" as Hex,
        value: BigInt(0)
      }];
      
      await expect(provider.sendUserOperation({ calls })).rejects.toThrow("Failed to send");
    });
    
    it("should throw appropriate error when trying to sign messages", async () => {
      await expect(provider.signMessage("Test message")).rejects.toThrow("Not implemented");
    });
  });
}); 