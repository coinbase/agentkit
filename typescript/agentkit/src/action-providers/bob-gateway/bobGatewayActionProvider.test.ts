import { EvmWalletProvider } from "../../wallet-providers";
import { approve, retryWithExponentialBackoff } from "../../utils";
import { BobGatewayActionProvider } from "./bobGatewayActionProvider";
import { GatewayClient } from "./gatewayClient";
import { SwapToBtcSchema, GetOrdersSchema, DEFAULT_SLIPPAGE_BPS } from "./schemas";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_TOKEN_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MOCK_BTC_ADDRESS = "bc1qafk4yhqvj4wep57m62dgrmutldusqde8adh20d";
const MOCK_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
const MOCK_ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

jest.mock("../../utils");
jest.mock("./gatewayClient");

const mockApprove = approve as jest.MockedFunction<typeof approve>;
const mockRetry = retryWithExponentialBackoff as jest.MockedFunction<
  typeof retryWithExponentialBackoff
>;

describe("BobGateway Action Provider", () => {
  let provider: BobGatewayActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockClient: jest.Mocked<GatewayClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = new GatewayClient() as jest.Mocked<GatewayClient>;

    provider = new BobGatewayActionProvider({ client: mockClient });

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest
        .fn()
        .mockResolvedValue({ status: "success", blockNumber: 1234567 }),
      readContract: jest
        .fn()
        .mockImplementation(async ({ functionName }: { functionName: string }) => {
          if (functionName === "decimals") return 6;
          if (functionName === "balanceOf") return BigInt("200000000"); // 200 USDC
          if (functionName === "symbol") return "USDC";
          return undefined;
        }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockClient.getRoutes = jest.fn().mockResolvedValue([
      { srcChain: "base", srcToken: MOCK_TOKEN_ADDRESS, dstChain: "bitcoin", dstToken: "BTC" },
      { srcChain: "bitcoin", srcToken: "BTC", dstChain: "base", dstToken: MOCK_TOKEN_ADDRESS },
    ]);

    mockApprove.mockResolvedValue("Successfully approved");
    mockRetry.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  describe("getSupportedRoutes", () => {
    it("should return only EVM to BTC routes with resolved token symbols", async () => {
      const result = await provider.getSupportedRoutes(mockWallet, {});

      expect(result).toContain("Supported BOB Gateway routes");
      expect(result).toContain("base: USDC");
      expect(result).toContain(MOCK_TOKEN_ADDRESS);
      expect(result).toContain("→ BTC");
      expect(result).not.toContain("bitcoin: BTC →");
    });

    it("should return empty message when no EVM to BTC routes exist", async () => {
      // No routes at all
      mockClient.getRoutes = jest.fn().mockResolvedValue([]);
      expect(await provider.getSupportedRoutes(mockWallet, {})).toContain("No supported routes");

      // Only BTC → EVM routes (no actionable routes)
      mockClient.getRoutes = jest
        .fn()
        .mockResolvedValue([
          { srcChain: "bitcoin", srcToken: "BTC", dstChain: "base", dstToken: MOCK_TOKEN_ADDRESS },
        ]);
      expect(await provider.getSupportedRoutes(mockWallet, {})).toContain("No supported routes");
    });

    it("should handle API errors gracefully", async () => {
      mockClient.getRoutes = jest.fn().mockRejectedValue(new Error("Network error"));

      expect(await provider.getSupportedRoutes(mockWallet, {})).toContain(
        "Error fetching supported routes",
      );
    });

    it("should only resolve symbols for tokens on the wallet's chain", async () => {
      const otherChainToken = "0x1111111111111111111111111111111111111111";
      mockClient.getRoutes = jest
        .fn()
        .mockResolvedValue([
          { srcChain: "ethereum", srcToken: otherChainToken, dstChain: "bitcoin", dstToken: "BTC" },
        ]);

      const result = await provider.getSupportedRoutes(mockWallet, {});

      expect(result).toContain(otherChainToken);
      expect(result).not.toContain("USDC");
    });
  });

  describe("swapToBtc", () => {
    const MOCK_EVM_ORDER = {
      orderId: MOCK_ORDER_ID,
      tx: {
        to: "0x0000000000000000000000000000000000000001" as `0x${string}`,
        data: "0xabcdef" as `0x${string}`,
        value: 0n,
      },
      type: "offramp" as const,
      expectedBtcOutput: "95000",
    };

    beforeEach(() => {
      mockClient.createEvmOrder = jest.fn().mockResolvedValue(MOCK_EVM_ORDER);
      mockClient.registerTx = jest.fn().mockResolvedValue(undefined);
    });

    it("should execute full swap flow and format result with amounts", async () => {
      const result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("Successfully initiated BTC swap");
      expect(result).toContain("Sent: 100 USDC");
      expect(result).toContain("Expected: 0.00095 BTC");
      expect(result).toContain(MOCK_ORDER_ID);
      expect(result).toContain(MOCK_BTC_ADDRESS);

      // Verify amount conversion: 100 USDC (6 decimals) = 100000000 atomic
      expect(mockClient.createEvmOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          srcChain: "base",
          amount: "100000000",
          slippage: String(DEFAULT_SLIPPAGE_BPS),
        }),
      );
      expect(mockApprove).toHaveBeenCalled();
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should skip approve for layerZero orders", async () => {
      mockClient.createEvmOrder = jest.fn().mockResolvedValue({
        ...MOCK_EVM_ORDER,
        type: "layerZero",
        tx: { ...MOCK_EVM_ORDER.tx, value: 50000n },
      });

      await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(mockApprove).not.toHaveBeenCalled();
    });

    it("should reject insufficient balance before creating order", async () => {
      mockWallet.readContract.mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === "decimals") return 6;
          if (functionName === "balanceOf") return BigInt("50000000"); // 50 USDC
          return undefined;
        },
      );

      const result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("Insufficient token balance");
      expect(mockClient.createEvmOrder).not.toHaveBeenCalled();
    });

    it("should resolve chain dynamically from routes and fall back to heuristic", async () => {
      // Dynamic resolution: "arbitrum-mainnet" → "arbitrum" via routes
      mockClient.getRoutes = jest.fn().mockResolvedValue([
        {
          srcChain: "arbitrum",
          srcToken: MOCK_TOKEN_ADDRESS,
          dstChain: "bitcoin",
          dstToken: "BTC",
        },
      ]);
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "arbitrum-mainnet",
      });

      let result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });
      expect(mockClient.createEvmOrder).toHaveBeenCalledWith(
        expect.objectContaining({ srcChain: "arbitrum" }),
      );

      // Heuristic fallback when routes API fails: "base-mainnet" → "base"
      jest.clearAllMocks();
      mockClient.createEvmOrder = jest.fn().mockResolvedValue(MOCK_EVM_ORDER);
      mockClient.registerTx = jest.fn().mockResolvedValue(undefined);
      mockClient.getRoutes = jest.fn().mockRejectedValue(new Error("Network error"));
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      });

      result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });
      expect(result).toContain("Successfully");
      expect(mockClient.createEvmOrder).toHaveBeenCalledWith(
        expect.objectContaining({ srcChain: "base" }),
      );
    });

    it("should reject unresolved chain and suggest get_supported_routes", async () => {
      mockWallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "unknown-network",
      });

      const result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("Could not determine source chain");
      expect(result).toContain("get_supported_routes");
    });

    it("should handle partial failures: revert, register failure, approval failure", async () => {
      // Transaction revert
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        blockNumber: 1234567,
      } as never);

      let result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });
      expect(result).toContain("transaction reverted");
      expect(result).toContain(MOCK_ORDER_ID);

      // Register failure (on-chain succeeded but gateway registration failed)
      mockWallet.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
        blockNumber: 1234567,
      } as never);
      mockRetry.mockRejectedValueOnce(new Error("Gateway timeout"));

      result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });
      expect(result).toContain("succeeded on-chain but failed to register");
      expect(result).toContain(MOCK_ORDER_ID);
      expect(result).toContain(MOCK_TX_HASH);

      // Approval failure (stops before sending tx)
      mockApprove.mockResolvedValueOnce("Error approving tokens: insufficient balance");

      result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });
      expect(result).toContain("Error approving token");
    });

    it("should not leak stack traces in error messages", async () => {
      const errorWithStack = new Error("Something failed");
      errorWithStack.stack = "Error: Something failed\n    at /internal/path/file.ts:123";
      mockClient.createEvmOrder = jest.fn().mockRejectedValue(errorWithStack);

      const result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("Something failed");
      expect(result).not.toContain("/internal/path");
    });

    it("should reject unsupported token and show available pairs with symbols", async () => {
      const result = await provider.swapToBtc(mockWallet, {
        amount: "100",
        tokenAddress: "0x0000000000000000000000000000000000000099",
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("not supported");
      expect(result).toContain("Available pairs");
      expect(result).toContain("USDC");
      expect(result).toContain(MOCK_TOKEN_ADDRESS);
      expect(mockClient.createEvmOrder).not.toHaveBeenCalled();
    });

    it("should reject zero amount", async () => {
      const result = await provider.swapToBtc(mockWallet, {
        amount: "0",
        tokenAddress: MOCK_TOKEN_ADDRESS,
        btcAddress: MOCK_BTC_ADDRESS,
        maxSlippage: 300,
      });

      expect(result).toContain("Amount must be greater than 0");
    });
  });

  describe("getOrders", () => {
    it("should fetch a single order by ID", async () => {
      mockClient.getOrderStatus = jest.fn().mockResolvedValue({
        timestamp: 1700000000,
        status: "inProgress",
        srcInfo: { chain: "bitcoin", token: "BTC", amount: "1000000", txHash: "btctx123" },
        dstInfo: { chain: "bob", token: "0xtoken", amount: "990000", txHash: null },
        estimatedTimeSecs: 600,
      });

      const result = await provider.getOrders(mockWallet, { orderId: MOCK_ORDER_ID });
      expect(result).toContain("inProgress");
      expect(result).toContain("btctx123");
      expect(result).toContain("600 seconds");
      expect(mockClient.getOrderStatus).toHaveBeenCalledWith(MOCK_ORDER_ID);
    });

    it("should fetch all orders for the wallet when no orderId given", async () => {
      mockClient.getOrdersByAddress = jest.fn().mockResolvedValue([
        {
          timestamp: 1700000000,
          status: "success",
          srcInfo: { chain: "base", token: "USDC", amount: "100", txHash: "0xabc" },
          dstInfo: { chain: "bitcoin", token: "BTC", amount: "0.001", txHash: "btctx1" },
          estimatedTimeSecs: null,
        },
        {
          timestamp: 1700000100,
          status: "inProgress",
          srcInfo: { chain: "base", token: "WBTC", amount: "0.5", txHash: "0xdef" },
          dstInfo: { chain: "bitcoin", token: "BTC", amount: "0.49", txHash: null },
          estimatedTimeSecs: 300,
        },
      ]);

      const result = await provider.getOrders(mockWallet, {});
      expect(result).toContain("orders (2)");
      expect(result).toContain("success");
      expect(result).toContain("inProgress");
      expect(mockClient.getOrdersByAddress).toHaveBeenCalledWith(MOCK_ADDRESS);
    });

    it("should return empty message when no orders exist", async () => {
      mockClient.getOrdersByAddress = jest.fn().mockResolvedValue([]);
      const result = await provider.getOrders(mockWallet, {});
      expect(result).toContain("No BOB Gateway orders found");
    });

    it("should handle errors gracefully", async () => {
      mockClient.getOrderStatus = jest.fn().mockRejectedValue(new Error("not found"));
      const result = await provider.getOrders(mockWallet, { orderId: MOCK_ORDER_ID });
      expect(result).toContain("Error");
    });
  });

  describe("supportsNetwork", () => {
    it("should accept EVM networks and reject non-EVM", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "unknown" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana", networkId: "mainnet" })).toBe(
        false,
      );
    });
  });

  describe("schema validation", () => {
    it("should validate BTC address formats", () => {
      const valid = [
        MOCK_BTC_ADDRESS,
        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
        "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
      ];
      for (const btcAddress of valid) {
        expect(
          SwapToBtcSchema.safeParse({
            amount: "100",
            tokenAddress: MOCK_TOKEN_ADDRESS,
            btcAddress,
          }).success,
        ).toBe(true);
      }

      for (const btcAddress of ["not-valid", MOCK_ADDRESS, ""]) {
        expect(
          SwapToBtcSchema.safeParse({
            amount: "100",
            tokenAddress: MOCK_TOKEN_ADDRESS,
            btcAddress,
          }).success,
        ).toBe(false);
      }
    });

    it("should validate amount strings and reject non-numeric values", () => {
      for (const amount of ["100", "0.01", "1000000", "0.00001"]) {
        expect(
          SwapToBtcSchema.safeParse({
            amount,
            tokenAddress: MOCK_TOKEN_ADDRESS,
            btcAddress: MOCK_BTC_ADDRESS,
          }).success,
        ).toBe(true);
      }

      for (const amount of ["NaN", "Infinity", "-1", "1e18", "", "abc", "1.2.3"]) {
        expect(
          SwapToBtcSchema.safeParse({
            amount,
            tokenAddress: MOCK_TOKEN_ADDRESS,
            btcAddress: MOCK_BTC_ADDRESS,
          }).success,
        ).toBe(false);
      }
    });

    it("should accept optional orderId and reject empty strings", () => {
      expect(GetOrdersSchema.safeParse({}).success).toBe(true);
      expect(GetOrdersSchema.safeParse({ orderId: MOCK_ORDER_ID }).success).toBe(true);
      expect(GetOrdersSchema.safeParse({ orderId: MOCK_TX_HASH }).success).toBe(true);
      expect(GetOrdersSchema.safeParse({ orderId: "" }).success).toBe(false);
    });

    it("should reject slippage above 1000 bps (10%)", () => {
      expect(
        SwapToBtcSchema.safeParse({
          amount: "100",
          tokenAddress: MOCK_TOKEN_ADDRESS,
          btcAddress: MOCK_BTC_ADDRESS,
          maxSlippage: 1001,
        }).success,
      ).toBe(false);
      expect(
        SwapToBtcSchema.safeParse({
          amount: "100",
          tokenAddress: MOCK_TOKEN_ADDRESS,
          btcAddress: MOCK_BTC_ADDRESS,
          maxSlippage: 1000,
        }).success,
      ).toBe(true);
    });
  });
});
