import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { RaydiumActionProvider } from "./raydiumActionProvider";

// Mock the @solana/web3.js module
jest.mock("@solana/web3.js", () => ({
  // Preserve the actual implementation of @solana/web3.js while overriding specific methods
  ...jest.requireActual("@solana/web3.js"),

  // Mock the Solana Connection class to prevent real network calls
  Connection: jest.fn(),
}));

// Mock the custom wallet provider used for Solana transactions
jest.mock("../../wallet-providers/svmWalletProvider");

describe("RaydiumActionProvider", () => {
  let actionProvider: RaydiumActionProvider;
  let mockWallet: jest.Mocked<SvmWalletProvider>;
  let mockConnection: jest.Mocked<Connection>;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks before each test to ensure no test interference

    // Initialize the action provider
    actionProvider = new RaydiumActionProvider();

    // Mock the Solana connection to avoid real network requests
    mockConnection = {
      getAccountInfo: jest.fn(),
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
    } as unknown as jest.Mocked<SvmWalletProvider>;
  });

  /**
   * Test cases for the getPools function of RaydiumActionProvider
   */
  describe("getPools", () => {
    /**
     * Test successful retrieval of pools with default limit
     */
    it("should successfully get pools with default limit", async () => {
      const result = await actionProvider.getPools(mockWallet, {});
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("pools");
      expect(parsed).toHaveProperty("count");
      expect(parsed.pools).toBeInstanceOf(Array);
      expect(parsed.pools.length).toBeLessThanOrEqual(10); // Default limit
      expect(parsed.pools[0]).toHaveProperty("pair");
      expect(parsed.pools[0]).toHaveProperty("poolId");
      expect(parsed.pools[0]).toHaveProperty("liquidity");
      expect(parsed.pools[0]).toHaveProperty("volume24h");
      expect(parsed.pools[0]).toHaveProperty("apr");
    });

    /**
     * Test retrieval of pools with custom limit
     */
    it("should respect custom limit parameter", async () => {
      const result = await actionProvider.getPools(mockWallet, { limit: 3 });
      const parsed = JSON.parse(result);

      expect(parsed.pools).toBeInstanceOf(Array);
      expect(parsed.pools.length).toBe(3);
    });
  });

  /**
   * Test cases for the getPrice function of RaydiumActionProvider
   */
  describe("getPrice", () => {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    /**
     * Test successful price retrieval for SOL-USDC pair
     */
    it("should successfully get price for valid token pair", async () => {
      const result = await actionProvider.getPrice(mockWallet, {
        tokenAMint: SOL_MINT,
        tokenBMint: USDC_MINT,
      });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("tokenAMint", SOL_MINT);
      expect(parsed).toHaveProperty("tokenBMint", USDC_MINT);
      expect(parsed).toHaveProperty("price");
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("source", "Raydium AMM");
      expect(typeof parsed.price).toBe("number");
    });

    /**
     * Test handling of unknown token pairs
     */
    it("should handle unknown token pair gracefully", async () => {
      const unknownMint = "UnknownTokenMintAddress111111111111111111111";
      const result = await actionProvider.getPrice(mockWallet, {
        tokenAMint: unknownMint,
        tokenBMint: USDC_MINT,
      });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("error");
      expect(parsed.error).toBe("Price not found");
    });
  });

  /**
   * Test cases for the swap function of RaydiumActionProvider
   */
  describe("swap", () => {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    const swapArgs = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: 1.0,
      slippageBps: 50,
    };

    /**
     * Test swap with valid parameters
     */
    it("should handle swap request with valid parameters", async () => {
      const result = await actionProvider.swap(mockWallet, swapArgs);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("message");
      expect(parsed).toHaveProperty("details");
      expect(parsed.details).toHaveProperty("wallet");
      expect(parsed.details).toHaveProperty("inputMint", SOL_MINT);
      expect(parsed.details).toHaveProperty("outputMint", USDC_MINT);
      expect(parsed.details).toHaveProperty("amount", 1.0);
      expect(parsed.details).toHaveProperty("slippageBps", 50);
    });

    /**
     * Test swap with invalid amount
     */
    it("should reject swap with zero or negative amount", async () => {
      const invalidArgs = { ...swapArgs, amount: 0 };
      const result = await actionProvider.swap(mockWallet, invalidArgs);

      expect(result).toContain("Error: Amount must be greater than 0");
    });

    /**
     * Test swap with custom slippage
     */
    it("should accept custom slippage parameter", async () => {
      const customSlippageArgs = { ...swapArgs, slippageBps: 100 };
      const result = await actionProvider.swap(mockWallet, customSlippageArgs);
      const parsed = JSON.parse(result);

      expect(parsed.details.slippageBps).toBe(100);
      expect(parsed.details.estimatedSlippage).toBe("1%");
    });
  });

  /**
   * Test cases for the getPoolInfo function of RaydiumActionProvider
   */
  describe("getPoolInfo", () => {
    const VALID_POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";

    /**
     * Test successful retrieval of pool info
     */
    it("should successfully get pool info for valid pool ID", async () => {
      // Mock that the pool account exists
      mockConnection.getAccountInfo.mockResolvedValue({
        owner: new PublicKey("11111111111111111111111111111111"),
        lamports: 1000000,
        data: Buffer.from([]),
        executable: false,
      } as AccountInfo<Buffer>);

      const result = await actionProvider.getPoolInfo(mockWallet, {
        poolId: VALID_POOL_ID,
      });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty("poolId", VALID_POOL_ID);
      expect(parsed).toHaveProperty("pair");
      expect(parsed).toHaveProperty("reserves");
      expect(parsed).toHaveProperty("fee");
      expect(parsed).toHaveProperty("apr");
      expect(parsed).toHaveProperty("volume24h");
      expect(parsed).toHaveProperty("tvl");
    });

    /**
     * Test handling of invalid pool ID format
     */
    it("should handle invalid pool ID format", async () => {
      const result = await actionProvider.getPoolInfo(mockWallet, {
        poolId: "invalid-pool-id",
      });

      expect(result).toContain("Error: Invalid pool ID format");
    });

    /**
     * Test handling of non-existent pool
     */
    it("should handle non-existent pool", async () => {
      // Mock that the pool account doesn't exist
      mockConnection.getAccountInfo.mockResolvedValue(null);

      const result = await actionProvider.getPoolInfo(mockWallet, {
        poolId: VALID_POOL_ID,
      });

      expect(result).toContain("Error: Pool");
      expect(result).toContain("not found");
    });
  });

  /**
   * Test cases for network support
   */
  describe("supportsNetwork", () => {
    test.each([
      [{ protocolFamily: "svm", networkId: "solana-mainnet" }, true, "solana mainnet"],
      [{ protocolFamily: "svm", networkId: "solana-devnet" }, false, "solana devnet"],
      [{ protocolFamily: "evm", networkId: "ethereum-mainnet" }, false, "ethereum mainnet"],
      [{ protocolFamily: "evm", networkId: "solana-mainnet" }, false, "wrong protocol family"],
      [{ protocolFamily: "svm", networkId: "ethereum-mainnet" }, false, "wrong network id"],
    ])("should return %p for %s", (network, expected) => {
      expect(actionProvider.supportsNetwork(network as any)).toBe(expected);
    });
  });
});

