import { ViemWalletProvider, ViemWalletProviderGasConfig } from "./viemWalletProvider";
import {
  TransactionRequest,
  Address,
  Hex,
  Chain,
  ReadContractParameters,
  Abi,
  PublicClient,
  WalletClient,
  TransactionReceipt,
  Account,
  ContractFunctionName,
} from "viem";

import * as viem from "viem";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response),
);

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// =========================================================
// consts
// =========================================================

const MOCK_CHAIN_ID = 84532;
const MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_ADDRESS_TO = "0x1234567890123456789012345678901234567890";
const MOCK_TRANSACTION_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const MOCK_SIGNATURE = "0x123456789abcdef" as `0x${string}`;
const MOCK_BALANCE = 10000000000000000000n;
const MOCK_BLOCK_NUMBER = 12345n;
const MOCK_MESSAGE = "Hello, World!";
const MOCK_MAX_FEE_PER_GAS = BigInt(1000000000);
const MOCK_MAX_PRIORITY_FEE_PER_GAS = BigInt(100000000);

const MOCK_CHAIN: Chain = {
  id: MOCK_CHAIN_ID,
  name: "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
  },
};

const MOCK_DATA = {
  domain: {
    name: "Example",
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

// =========================================================
// mocks
// =========================================================

jest.mock("../network/network", () => ({
  CHAIN_ID_TO_NETWORK_ID: {
    1: "mainnet",
    5: "goerli",
    11155111: "sepolia",
  },
}));

jest.mock("viem", () => {
  return {
    createPublicClient: jest.fn(),
    createWalletClient: jest.fn(),
    http: jest.fn(() => jest.fn()),
    parseEther: jest.fn(() => BigInt(1000000000000000000)),
    hexToString: jest.fn(),
    fromHex: jest.fn(),
    formatEther: jest.fn(),
    privateKeyToAccount: jest.fn(),
  };
});

jest.mock("viem/accounts", () => {
  return {
    privateKeyToAccount: jest.fn(),
  };
});

describe("ViemWalletProvider", () => {
  let provider: ViemWalletProvider;
  let mockPublicClient: jest.Mocked<PublicClient>;
  let mockWalletClient: jest.Mocked<WalletClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockAccount = {
      address: MOCK_ADDRESS as Address,
    } as unknown as jest.Mocked<Account>;

    mockPublicClient = {
      chain: MOCK_CHAIN,
      getBalance: jest.fn(),
      getChainId: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      estimateFeesPerGas: jest.fn(),
      estimateGas: jest.fn(),
    } as unknown as jest.Mocked<PublicClient>;

    mockPublicClient.getBalance.mockResolvedValue(MOCK_BALANCE);
    mockPublicClient.getChainId.mockResolvedValue(MOCK_CHAIN_ID);
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_TRANSACTION_HASH,
      blockNumber: MOCK_BLOCK_NUMBER,
      status: "success",
    } as unknown as jest.Mocked<TransactionReceipt>);
    mockPublicClient.readContract.mockResolvedValue("mock_result");
    mockPublicClient.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: MOCK_MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MOCK_MAX_PRIORITY_FEE_PER_GAS,
    });
    mockPublicClient.estimateGas.mockResolvedValue(BigInt(21000));

    mockWalletClient = {
      chain: MOCK_CHAIN,
      transport: {
        name: "HTTP JSON-RPC",
        request: jest.fn(),
        value: { url: "https://ethereum.example.com" },
      },
      account: mockAccount,
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
      signTransaction: jest.fn(),
      sendTransaction: jest.fn(),
    } as unknown as jest.Mocked<WalletClient>;

    mockWalletClient.signMessage.mockResolvedValue(MOCK_SIGNATURE);
    mockWalletClient.signTypedData.mockResolvedValue(MOCK_SIGNATURE);
    mockWalletClient.signTransaction.mockResolvedValue(MOCK_SIGNATURE as `0x02${string}`);
    mockWalletClient.sendTransaction.mockResolvedValue(MOCK_TRANSACTION_HASH as Hex);

    (viem.createPublicClient as unknown as jest.Mock).mockReturnValue(mockPublicClient);
    (viem.createWalletClient as unknown as jest.Mock).mockReturnValue(mockWalletClient);
    (viem.http as unknown as jest.Mock).mockReturnValue(jest.fn());

    provider = new ViemWalletProvider(mockWalletClient);
  });

  describe("configuration and initialization", () => {
    it("should create a provider with default gas multipliers", () => {
      const provider = new ViemWalletProvider(mockWalletClient);
      expect(provider).toBeInstanceOf(ViemWalletProvider);
      expect(viem.createPublicClient).toHaveBeenCalledWith({
        chain: MOCK_CHAIN,
        transport: expect.any(Function),
      });
    });

    it("should create a provider with custom gas multipliers", () => {
      const gasConfig: ViemWalletProviderGasConfig = {
        gasLimitMultiplier: 1.5,
        feePerGasMultiplier: 1.2,
      };
      const provider = new ViemWalletProvider(mockWalletClient, gasConfig);
      expect(provider).toBeInstanceOf(ViemWalletProvider);
    });
  });

  describe("basic wallet methods", () => {
    it("should get wallet address", () => {
      const address = provider.getAddress();
      expect(address).toBe(MOCK_ADDRESS);
    });

    it("should get network", () => {
      const network = provider.getNetwork();
      expect(network.chainId).toBe(String(MOCK_CHAIN_ID));
      expect(network.protocolFamily).toBe("evm");
    });

    it("should get wallet name", () => {
      const name = provider.getName();
      expect(name).toBe("viem_wallet_provider");
    });

    it("should get balance", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBe(MOCK_BALANCE);
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: MOCK_ADDRESS,
      });
    });

    it("should handle connection errors during balance check", async () => {
      mockPublicClient.getBalance.mockRejectedValueOnce(new Error("Network connection error"));

      await expect(provider.getBalance()).rejects.toThrow("Network connection error");
    });
  });

  describe("signing operations", () => {
    it("should sign a message", async () => {
      const signature = await provider.signMessage(MOCK_MESSAGE);
      expect(mockWalletClient.signMessage).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        message: MOCK_MESSAGE,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign typed data", async () => {
      const signature = await provider.signTypedData(MOCK_DATA);
      expect(mockWalletClient.signTypedData).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        ...MOCK_DATA,
      });
      expect(signature).toBe(MOCK_SIGNATURE);
    });

    it("should sign a transaction", async () => {
      const transaction: TransactionRequest = {
        to: MOCK_ADDRESS_TO as Address,
        value: BigInt(1000000000000000000),
      };

      await provider.signTransaction(transaction);

      expect(mockWalletClient.signTransaction).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        chain: mockWalletClient.chain,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
      });
    });

    it("should handle signing errors", async () => {
      mockWalletClient.signMessage.mockRejectedValueOnce(new Error("Signing failed"));
      await expect(provider.signMessage("test message")).rejects.toThrow("Signing failed");
    });

    it("should handle typed data signing errors", async () => {
      mockWalletClient.signTypedData.mockRejectedValueOnce(new Error("Signing failed"));
      await expect(provider.signTypedData(MOCK_DATA)).rejects.toThrow("Signing failed");
    });
  });

  describe("transaction operations", () => {
    it("should send a transaction", async () => {
      const transaction: TransactionRequest = {
        to: MOCK_ADDRESS_TO as Address,
        value: BigInt(1000000000000000000),
      };

      const hash = await provider.sendTransaction(transaction);

      expect(mockWalletClient.sendTransaction).toHaveBeenCalled();
      expect(hash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should wait for a transaction receipt", async () => {
      const receipt = await provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: MOCK_TRANSACTION_HASH,
      });
      expect(receipt).toEqual({
        transactionHash: MOCK_TRANSACTION_HASH,
        blockNumber: MOCK_BLOCK_NUMBER,
        status: "success",
      });
    });

    it("should handle transaction send errors", async () => {
      mockWalletClient.sendTransaction.mockRejectedValueOnce(new Error("Transaction failed"));

      const transaction: TransactionRequest = {
        to: MOCK_ADDRESS_TO as Address,
        value: BigInt(1000000000000000000),
      };

      await expect(provider.sendTransaction(transaction)).rejects.toThrow("Transaction failed");
    });

    it("should handle transaction receipt wait errors", async () => {
      mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(
        new Error("Receipt retrieval failed"),
      );

      await expect(
        provider.waitForTransactionReceipt(MOCK_TRANSACTION_HASH as Hex),
      ).rejects.toThrow("Receipt retrieval failed");
    });
  });

  describe("native token operations", () => {
    it("should transfer native tokens", async () => {
      (viem.parseEther as jest.Mock).mockReturnValueOnce(BigInt(1000000000000000000));

      const hash = await provider.nativeTransfer(MOCK_ADDRESS_TO as Address, "1.0");

      expect(viem.parseEther as jest.Mock).toHaveBeenCalledWith("1.0");
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled();
      expect(hash).toBe(MOCK_TRANSACTION_HASH);
    });

    it("should handle native transfer errors", async () => {
      mockWalletClient.sendTransaction.mockRejectedValueOnce(new Error("Transaction failed"));

      await expect(provider.nativeTransfer(MOCK_ADDRESS_TO as Address, "1.0")).rejects.toThrow(
        "Transaction failed",
      );
    });

    it("should handle invalid address in native transfer", async () => {
      const invalidAddress = "not_a_valid_address";

      mockWalletClient.sendTransaction.mockImplementationOnce(() => {
        throw new Error("Invalid address");
      });

      await expect(
        provider.nativeTransfer(invalidAddress as unknown as Address, "1.0"),
      ).rejects.toThrow();
    });
  });

  describe("contract interactions", () => {
    it("should read contract data", async () => {
      const contractParams: ReadContractParameters = {
        address: MOCK_ADDRESS_TO as Address,
        abi: [] as unknown as Abi,
        functionName: "balanceOf" as unknown as ContractFunctionName,
        args: [MOCK_ADDRESS] as unknown[],
      };

      const result = await provider.readContract(contractParams);

      expect(mockPublicClient.readContract).toHaveBeenCalledWith(contractParams);
      expect(result).toBe("mock_result");
    });

    it("should handle contract read errors", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("Contract read failed"));

      const contractParams: ReadContractParameters = {
        address: MOCK_ADDRESS_TO as Address,
        abi: [] as unknown as Abi,
        functionName: "balanceOf" as unknown as ContractFunctionName,
        args: [MOCK_ADDRESS] as unknown[],
      };

      await expect(provider.readContract(contractParams)).rejects.toThrow("Contract read failed");
    });

    it("should handle invalid ABI in contract read", async () => {
      mockPublicClient.readContract.mockRejectedValueOnce(new TypeError("Invalid ABI format"));

      const contractParams: ReadContractParameters = {
        address: MOCK_ADDRESS_TO as Address,
        abi: "invalid abi" as unknown as Abi,
        functionName: "balanceOf" as unknown as ContractFunctionName,
        args: [MOCK_ADDRESS] as unknown[],
      };

      await expect(provider.readContract(contractParams)).rejects.toThrow("Invalid ABI format");
    });
  });
});
