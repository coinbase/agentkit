import { ZoraActionProvider } from "./zoraActionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { CreateCoinSchema } from "./schemas";
import { Network } from "../../network";
import { Hex } from "viem";

// Mock viem's encodeFunctionData function to prevent ABI errors
jest.mock("viem", () => {
  const originalModule = jest.requireActual("viem");
  return {
    ...originalModule,
    encodeFunctionData: jest.fn().mockReturnValue("0x1234"),
  };
});

// Mock the dynamically imported Zora SDK
jest.mock(
  "@zoralabs/coins-sdk",
  () => ({
    createCoinCall: jest.fn().mockResolvedValue({
      abi: [{ name: "createCoin" }], // Add a minimal abi to prevent "function not found" error
      functionName: "createCoin",
      address: "0x1234567890123456789012345678901234567890",
      args: [],
      value: BigInt(0),
    }),
    getCoinCreateFromLogs: jest.fn().mockReturnValue({
      coin: "0x2345678901234567890123456789012345678901",
    }),
    DeployCurrency: {
      ZORA: "ZORA",
      ETH: "ETH",
    },
  }),
  { virtual: true },
);

// Mock the utils module
jest.mock("./utils", () => ({
  generateZoraTokenUri: jest.fn().mockResolvedValue({
    uri: "ipfs://testCID",
    imageUri: "ipfs://testImageCID",
  }),
}));

describe("ZoraActionProvider", () => {
  const MOCK_TX_HASH = "0xabcdef1234567890";
  const MOCK_ADDRESS = "0x9876543210987654321098765432109876543210";

  let provider: ZoraActionProvider;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;
  let originalPinataJwt: string | undefined;

  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
    originalPinataJwt = process.env.PINATA_JWT;
    process.env.PINATA_JWT = "test-jwt";

    // Create the provider
    provider = new ZoraActionProvider();

    // Set up the mock wallet provider
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as Hex),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({
        status: "success",
        logs: [],
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    process.env.PINATA_JWT = originalPinataJwt;
  });

  describe("constructor", () => {
    it("should throw an error if Pinata JWT is not provided", () => {
      delete process.env.PINATA_JWT;
      expect(() => new ZoraActionProvider()).toThrow(
        "PINATA_JWT is not configured. Required for IPFS uploads.",
      );
    });

    it("should create provider with Pinata JWT from environment", () => {
      expect(new ZoraActionProvider()).toBeInstanceOf(ZoraActionProvider);
    });
  });

  describe("supportsNetwork", () => {
    const testCases = [
      { network: { protocolFamily: "evm", networkId: "base-mainnet" }, expected: true },
      { network: { protocolFamily: "evm", networkId: "base-sepolia" }, expected: true },
      { network: { protocolFamily: "evm", networkId: "ethereum" }, expected: false },
      { network: { protocolFamily: "solana", networkId: "base-mainnet" }, expected: false },
    ];

    testCases.forEach(({ network, expected }) => {
      it(`should ${expected ? "support" : "not support"} ${network.protocolFamily}/${network.networkId}`, () => {
        expect(provider.supportsNetwork(network as Network)).toBe(expected);
      });
    });
  });

  describe("createCoin", () => {
    it("should validate createCoin schema", () => {
      const validInput = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      const parseResult = CreateCoinSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it("should reject invalid input", () => {
      const invalidInput = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
        payoutRecipient: "invalid-address", // Should be 0x format
      };

      const parseResult = CreateCoinSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });

    it("should successfully create a coin", async () => {
      const args = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      const result = await provider.createCoin(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(mockWalletProvider.sendTransaction).toHaveBeenCalled();
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.transactionHash).toBe(MOCK_TX_HASH);
      expect(parsedResult.coinAddress).toBe("0x2345678901234567890123456789012345678901");
    });

    it("should include zoraURL for base-mainnet network", async () => {
      // Mock wallet provider to return base-mainnet network
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });

      const args = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      const result = await provider.createCoin(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.coinAddress).toBe("0x2345678901234567890123456789012345678901");
      expect(parsedResult.zoraURL).toBe(
        "https://zora.co/coin/base:0x2345678901234567890123456789012345678901",
      );
    });

    it("should not include zoraURL for non-base-mainnet networks", async () => {
      // Keep the default base-sepolia network from beforeEach
      const args = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      const result = await provider.createCoin(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.coinAddress).toBe("0x2345678901234567890123456789012345678901");
      expect(parsedResult.zoraURL).toBeUndefined();
    });

    it("should handle transaction failure", async () => {
      const args = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      // Mock a reverted transaction
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        logs: [],
      });

      const result = await provider.createCoin(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Coin creation transaction reverted");
    });

    it("should handle errors", async () => {
      const args = {
        name: "Test Coin",
        symbol: "TEST",
        description: "A test coin",
        image: "https://example.com/image.png",
        category: "social",
        currency: "ZORA" as const,
      };

      // Create an error that will be thrown during the request
      const error = new Error("Failed to create coin");
      mockWalletProvider.sendTransaction.mockRejectedValueOnce(error);

      const result = await provider.createCoin(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("Failed to create coin");
    });
  });
});
