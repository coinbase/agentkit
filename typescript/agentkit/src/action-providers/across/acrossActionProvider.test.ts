import { acrossActionProvider } from "./acrossActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { createPublicClient, PublicClient } from "viem";

// Mock the necessary imports and modules
jest.mock("viem", () => {
  return {
    ...jest.requireActual("viem"),
    createPublicClient: jest.fn(),
    createWalletClient: jest.fn(() => ({
      writeContract: jest.fn().mockResolvedValue("0xdepositTxHash"),
    })),
    http: jest.fn(),
    formatUnits: jest.fn().mockImplementation((value, decimals) => {
      // Simple mock implementation just for testing
      if (typeof value === "bigint") {
        if (decimals === 18) {
          return (Number(value) / 10 ** 18).toString();
        }
        return value.toString();
      }
      return value.toString();
    }),
    parseUnits: jest.fn().mockImplementation((value, decimals) => {
      if (decimals === 18) {
        return BigInt(Number(value) * 10 ** 18);
      }
      return BigInt(value);
    }),
  };
});

jest.mock("viem/accounts", () => ({
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: "0x9876543210987654321098765432109876543210",
  }),
}));

// Mock the network module
jest.mock("../../network", () => {
  return {
    ...jest.requireActual("../../network"),
    NETWORK_ID_TO_VIEM_CHAIN: {
      "ethereum-mainnet": {
        id: 1,
        name: "Ethereum",
        network: "mainnet",
      },
      optimism: {
        id: 10,
        name: "Optimism",
        network: "optimism",
      },
      "base-sepolia": {
        id: 84532,
        name: "Base Sepolia",
        network: "base-sepolia",
      },
    },
    CHAIN_ID_TO_NETWORK_ID: {
      "1": "ethereum-mainnet",
      "10": "optimism",
      "84532": "base-sepolia",
    },
  };
});

// Mock the Across SDK
const mockCreateAcrossClient = jest.fn();
jest.mock("@across-protocol/app-sdk", () => ({
  createAcrossClient: mockCreateAcrossClient,
}));

// Default implementation for the createAcrossClient mock
const defaultClientImplementation = () => ({
  getSupportedChains: jest.fn().mockResolvedValue([
    {
      chainId: 1, // Ethereum
      name: "Ethereum",
      network: "mainnet",
      inputTokens: [
        {
          symbol: "ETH",
          address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          decimals: 18,
        },
        {
          symbol: "USDC",
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          decimals: 6,
        },
      ],
    },
    {
      chainId: 10, // Optimism
      name: "Optimism",
      network: "optimism",
      inputTokens: [
        {
          symbol: "ETH",
          address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          decimals: 18,
        },
      ],
    },
  ]),
  getAvailableRoutes: jest.fn().mockResolvedValue([
    {
      isNative: true,
      originToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    },
    {
      isNative: false,
      originToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
  ]),
  getQuote: jest.fn().mockResolvedValue({
    deposit: {
      inputAmount: BigInt("1000000000000000000"), // 1 ETH
      outputAmount: BigInt("990000000000000000"), // 0.99 ETH (1% difference)
      spokePoolAddress: "0x1234567890123456789012345678901234567890",
    },
    limits: {
      minDeposit: BigInt("100000000000000000"), // 0.1 ETH
      maxDeposit: BigInt("10000000000000000000"), // 10 ETH
    },
  }),
  simulateDepositTx: jest.fn().mockResolvedValue({
    request: {
      address: "0x1234567890123456789012345678901234567890",
      abi: [],
      functionName: "deposit",
      args: [],
    },
  }),
  waitForDepositTx: jest.fn().mockResolvedValue({
    depositId: "123456",
  }),
});

// Set the default implementation
mockCreateAcrossClient.mockImplementation(() => {
  const client = defaultClientImplementation();
  // Add the chains property to match what the code expects
  return {
    ...client,
    chains: [
      {
        id: 1,
        name: "Ethereum",
        network: "mainnet",
      },
      {
        id: 10,
        name: "Optimism",
        network: "optimism",
      },
    ],
  };
});

// Mock the isTestnet function
jest.mock("./utils", () => ({
  isAcrossSupportedTestnet: jest.fn().mockReturnValue(false),
}));

describe("Across Action Provider", () => {
  const MOCK_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const MOCK_INPUT_TOKEN_SYMBOL = "ETH";
  const MOCK_AMOUNT = "1.0";
  const MOCK_DESTINATION_CHAIN_ID = "10"; // Optimism
  const MOCK_RECIPIENT = "0x9876543210987654321098765432109876543210";
  const MOCK_MAX_SLIPPAGE = 2.0;

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ReturnType<typeof acrossActionProvider>;
  let mockPublicClient: PublicClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default implementation
    mockCreateAcrossClient.mockImplementation(() => {
      const client = defaultClientImplementation();
      // Add the chains property to match what the code expects
      return {
        ...client,
        chains: [
          {
            id: 1,
            name: "Ethereum",
            network: "mainnet",
          },
          {
            id: 10,
            name: "Optimism",
            network: "optimism",
          },
        ],
      };
    });

    mockPublicClient = {
      getBalance: jest.fn().mockResolvedValue(BigInt("2000000000000000000")), // 2 ETH
      readContract: jest.fn().mockResolvedValue(BigInt("2000000000000000000")), // 2 ETH or 2 USDC
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
    } as unknown as PublicClient;

    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_RECIPIENT),
      sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash"),
      waitForTransactionReceipt: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        chainId: "1", // Ethereum mainnet
        networkId: "ethereum-mainnet",
        protocolFamily: "evm",
      }),
      getBalance: jest.fn().mockResolvedValue(BigInt("2000000000000000000")), // 2 ETH
      readContract: jest.fn().mockResolvedValue(BigInt("2000000000000000000")), // 2 ETH/USDC
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = acrossActionProvider({
      privateKey: MOCK_PRIVATE_KEY,
    });
  });

  describe("bridgeToken", () => {
    it("should successfully bridge native ETH", async () => {
      const args = {
        inputTokenSymbol: MOCK_INPUT_TOKEN_SYMBOL,
        amount: MOCK_AMOUNT,
        destinationChainId: MOCK_DESTINATION_CHAIN_ID,
        recipient: MOCK_RECIPIENT,
        maxSplippage: MOCK_MAX_SLIPPAGE,
      };

      const response = await actionProvider.bridgeToken(mockWallet, args);

      // Verify the SDK interactions and response
      expect(response).toContain("Successfully deposited tokens");
      expect(response).toContain(`Token: ${MOCK_INPUT_TOKEN_SYMBOL}`);
      expect(response).toContain("Transaction Hash for deposit: 0xdepositTxHash");
    });

    it("should successfully bridge ERC20 tokens", async () => {
      const args = {
        inputTokenSymbol: "USDC",
        amount: "100",
        destinationChainId: MOCK_DESTINATION_CHAIN_ID,
        recipient: MOCK_RECIPIENT,
        maxSplippage: MOCK_MAX_SLIPPAGE,
      };

      // Set up mock for approval and deposit transactions
      mockWallet.sendTransaction
        .mockResolvedValueOnce("0xapprovalTxHash")
        .mockResolvedValueOnce("0xdepositTxHash");

      const response = await actionProvider.bridgeToken(mockWallet, args);

      // Verify the SDK interactions and response
      expect(response).toContain("Successfully deposited tokens");
      expect(response).toContain(`Token: ${args.inputTokenSymbol}`);
      expect(response).toContain("Transaction Hash for approval: 0xapprovalTxHash");
      expect(response).toContain("Transaction Hash for deposit: 0xdepositTxHash");
    });

    it("should fail when slippage is too high", async () => {
      // Override the default mock with high slippage for this test only
      mockCreateAcrossClient.mockImplementationOnce(() => ({
        getSupportedChains: jest.fn().mockResolvedValue([
          {
            chainId: 1,
            inputTokens: [
              {
                symbol: "ETH",
                address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                decimals: 18,
              },
            ],
          },
        ]),
        getAvailableRoutes: jest.fn().mockResolvedValue([
          {
            isNative: true,
            originToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          },
        ]),
        getQuote: jest.fn().mockResolvedValue({
          deposit: {
            inputAmount: BigInt("1000000000000000000"), // 1 ETH
            outputAmount: BigInt("800000000000000000"), // 0.8 ETH (20% difference)
            spokePoolAddress: "0x1234567890123456789012345678901234567890",
          },
          limits: {
            minDeposit: BigInt("100000000000000000"),
            maxDeposit: BigInt("10000000000000000000"),
          },
        }),
        simulateDepositTx: jest.fn().mockResolvedValue({
          request: {
            address: "0x1234567890123456789012345678901234567890",
            abi: [],
            functionName: "deposit",
            args: [],
          },
        }),
        waitForDepositTx: jest.fn().mockResolvedValue({
          depositId: "123456",
        }),
      }));

      // Set a low max slippage
      const args = {
        inputTokenSymbol: MOCK_INPUT_TOKEN_SYMBOL,
        amount: MOCK_AMOUNT,
        destinationChainId: MOCK_DESTINATION_CHAIN_ID,
        recipient: MOCK_RECIPIENT,
        maxSplippage: 0.5, // Only allow 0.5% slippage
      };

      const response = await actionProvider.bridgeToken(mockWallet, args);

      // Verify the error response
      expect(response).toContain("Error with Across SDK");
      expect(response).toContain("exceeds the maximum allowed slippage of 0.5%");
    });

    it("should handle errors in bridging", async () => {
      const error = new Error("Insufficient balance");
      mockWallet.getBalance.mockRejectedValueOnce(error);
      mockWallet.sendTransaction.mockRejectedValueOnce(error);

      const args = {
        inputTokenSymbol: MOCK_INPUT_TOKEN_SYMBOL,
        amount: MOCK_AMOUNT,
        destinationChainId: MOCK_DESTINATION_CHAIN_ID,
        recipient: MOCK_RECIPIENT,
        maxSplippage: MOCK_MAX_SLIPPAGE,
      };

      const response = await actionProvider.bridgeToken(mockWallet, args);

      expect(response).toContain("Error with Across SDK");
      expect(response).toContain(error.message);
    });
  });

  describe("checkDepositStatus", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it("should successfully check deposit status", async () => {
      // Mock successful API response
      const mockApiResponse = {
        status: "filled",
        originChainId: 1,
        destinationChainId: 10,
        depositTxHash: "0xdepositTxHash",
        fillTx: "0xfillTxHash",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const args = {
        originChainId: "1",
        depositId: "123456",
      };

      const response = await actionProvider.checkDepositStatus(mockWallet, args);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.status).toEqual("filled");
      expect(parsedResponse.depositTxInfo.txHash).toEqual("0xdepositTxHash");
      expect(parsedResponse.fillTxInfo.txHash).toEqual("0xfillTxHash");
    });

    it("should handle API errors", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const args = {
        originChainId: "1",
        depositId: "123456",
      };

      const response = await actionProvider.checkDepositStatus(mockWallet, args);

      expect(response).toContain("Error checking deposit status");
      expect(response).toContain("404");
    });

    it("should handle network errors", async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const args = {
        originChainId: "1",
        depositId: "123456",
      };

      const response = await actionProvider.checkDepositStatus(mockWallet, args);

      expect(response).toContain("Error checking deposit status");
      expect(response).toContain("Network error");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for supported networks", () => {
      const evmNetwork: Network = {
        protocolFamily: "evm",
        networkId: "ethereum",
        chainId: "1",
      };
      expect(actionProvider.supportsNetwork(evmNetwork)).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      const nonEvmNetwork: Network = {
        protocolFamily: "solana",
        networkId: "mainnet",
      };
      expect(actionProvider.supportsNetwork(nonEvmNetwork)).toBe(false);
    });
  });
});
