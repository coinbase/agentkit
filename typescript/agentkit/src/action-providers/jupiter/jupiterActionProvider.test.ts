import { Connection, PublicKey } from "@solana/web3.js";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { JupiterActionProvider } from "./jupiterActionProvider";
import { createJupiterApiClient } from "@jup-ag/api";

// Default SPL token decimals for tests
const DECIMALS = 6;

// Mock the @solana/web3.js module
jest.mock("@solana/web3.js", () => ({
  // Preserve the actual implementation of @solana/web3.js while overriding specific methods
  ...jest.requireActual("@solana/web3.js"),

  // Mock the Solana Connection class to prevent real network calls
  Connection: jest.fn(),

  // Mock the VersionedTransaction class and its deserialize method
  VersionedTransaction: {
    deserialize: jest.fn().mockReturnValue({
      // Mock the sign method to prevent actual signing operations
      sign: jest.fn(),
    }),
  },

  // Mock the MessageV0 class and its compile method to return an empty object
  MessageV0: {
    compile: jest.fn().mockReturnValue({}),
  },
}));

// Mock the @solana/spl-token module
jest.mock("@solana/spl-token", () => ({
  // Preserve the actual implementation of @solana/spl-token while overriding specific methods
  ...jest.requireActual("@solana/spl-token"),

  // Mock getMint to always return a fixed decimal value for tokens
  getMint: jest.fn().mockReturnValue({ decimals: DECIMALS }),
}));

// Mock the @jup-ag/api module
jest.mock("@jup-ag/api", () => ({
  // Mock the createJupiterApiClient function to return an object with mocked methods
  createJupiterApiClient: jest.fn().mockReturnValue({
    // Mock the quoteGet method, which fetches the best swap route
    quoteGet: jest.fn(),

    // Mock the swapPost method, which generates the swap transaction
    swapPost: jest.fn(),
  }),
}));

// Mock the custom wallet provider used for Solana transactions
jest.mock("../../wallet-providers/svmWalletProvider");

describe("JupiterActionProvider", () => {
  let actionProvider;
  let mockWallet;
  let mockConnection;
  let mockJupiterApi;
  let mockQuoteGet;
  let mockSwapPost;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks before each test to ensure no test interference

    // Create a mock Jupiter API client with mocked methods
    mockJupiterApi = createJupiterApiClient();
    mockQuoteGet = mockJupiterApi.quoteGet;
    mockSwapPost = mockJupiterApi.swapPost;

    // Initialize the action provider
    actionProvider = new JupiterActionProvider();

    // Mock the Solana connection to avoid real network requests
    mockConnection = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: "mockedBlockhash" }),
    } as unknown as jest.Mocked<Connection>;

    // Mock the wallet provider with necessary methods
    mockWallet = {
      getConnection: jest.fn().mockReturnValue(mockConnection), // Return the mocked connection
      getPublicKey: jest.fn().mockReturnValue(new PublicKey("11111111111111111111111111111111")),
      signAndSendTransaction: jest.fn().mockResolvedValue("mock-signature"),
      waitForSignatureResult: jest.fn().mockResolvedValue({
        context: { slot: 1234 },
        value: { err: null },
      }),
      getAddress: jest.fn().mockReturnValue("11111111111111111111111111111111"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "svm", networkId: "solana-mainnet" }),
      getName: jest.fn().mockReturnValue("mock-wallet"),
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<SvmWalletProvider>;
  });

  /**
   * Test cases for the swap function of JupiterActionProvider
   */
  describe("swap", () => {
    const INPUT_MINT = "So11111111111111111111111111111111111111112"; // Mock SOL mint address
    const OUTPUT_MINT = "BXXkv6FbfHZmKbMmy6KvaakKt6bYjhbjmhvJ92kp92Mw"; // Mock token mint address
    const MOCK_SIGNATURE = "mock-signature";

    // Mock arguments for swapping tokens
    const swapArgs = {
      inputMint: INPUT_MINT,
      outputMint: OUTPUT_MINT,
      amount: 1000, // User-specified amount
      slippageBps: 50, // Slippage tolerance
    };

    /**
     * Test successful token swap execution
     */
    it("should successfully swap tokens", async () => {
      // Mock a successful quote response from Jupiter
      mockQuoteGet.mockResolvedValue({ route: "mock-route" });

      // Mock a successful swap transaction response from Jupiter
      mockSwapPost.mockResolvedValue({
        swapTransaction: Buffer.from("mock-transaction").toString("base64"),
      });

      // Call the swap function
      const result = await actionProvider.swap(mockWallet, swapArgs);

      // Verify that Jupiter was called with correct parameters
      expect(mockQuoteGet).toHaveBeenCalledWith({
        inputMint: INPUT_MINT,
        outputMint: OUTPUT_MINT,
        amount: swapArgs.amount * 10 ** DECIMALS, // Ensure correct decimal conversion
        slippageBps: swapArgs.slippageBps,
      });

      expect(mockSwapPost).toHaveBeenCalled();
      expect(mockWallet.waitForSignatureResult).toHaveBeenCalledWith(MOCK_SIGNATURE);
      expect(result).toContain("Successfully swapped");
    });

    /**
     * Test handling of errors when retrieving a swap quote
     */
    it("should handle swap quote errors", async () => {
      mockQuoteGet.mockRejectedValue(new Error("Quote error")); // Simulate an API failure

      const result = await actionProvider.swap(mockWallet, swapArgs);
      expect(result).toBe("Error swapping tokens: Error: Quote error");
    });

    /**
     * Test handling of errors when posting a swap transaction
     */
    it("should handle swap transaction errors", async () => {
      mockQuoteGet.mockResolvedValue({ route: "mock-route" });
      mockSwapPost.mockRejectedValue(new Error("Swap transaction error")); // Simulate a failure

      const result = await actionProvider.swap(mockWallet, swapArgs);
      expect(result).toBe("Error swapping tokens: Error: Swap transaction error");
    });
  });

  describe("supportsNetwork", () => {
    test.each([
      [{ protocolFamily: "svm", networkId: "solana-mainnet" }, true, "solana mainnet"],
      [{ protocolFamily: "svm", networkId: "solana-devnet" }, false, "solana devnet"],
      [{ protocolFamily: "evm", networkId: "ethereum-mainnet" }, false, "ethereum mainnet"],
      [{ protocolFamily: "evm", networkId: "solana-mainnet" }, false, "wrong protocol family"],
      [{ protocolFamily: "svm", networkId: "ethereum-mainnet" }, false, "wrong network id"],
    ])("should return %p for %s", (network, expected) => {
      expect(actionProvider.supportsNetwork(network)).toBe(expected);
    });
  });
});
