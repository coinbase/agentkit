import {
  buildPoolKey,
  computePoolId,
  getSwapDirection,
  applySlippage,
  encodeSwapExactInSingle,
  encodeSwapExactOutSingle,
  encodeSettleAll,
  encodeTakeAll,
  encodeV4SwapInput,
  buildExactInputSwapData,
  buildExactOutputSwapData,
  formatTokenAmount,
  resolveTokenAddress,
  isNativeToken,
} from "./utils";
import { NATIVE_ETH, DEFAULT_FEE } from "./constants";
import { getAddress } from "viem";

// Helper addresses
const TOKEN_A = "0xa0b86a33e6c16c36c746e44478b23e0632be38d0" as `0x${string}`;
const TOKEN_B = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" as `0x${string}`; // Higher address
const RECIPIENT = getAddress("0x1234567890123456789012345678901234567890");

describe("utils", () => {
  describe("resolveTokenAddress", () => {
    it("should return NATIVE_ETH for 'native'", () => {
      expect(resolveTokenAddress("native")).toBe(NATIVE_ETH);
    });

    it("should return NATIVE_ETH for 'eth'", () => {
      expect(resolveTokenAddress("eth")).toBe(NATIVE_ETH);
    });

    it("should return the address as-is for token addresses", () => {
      const result = resolveTokenAddress(TOKEN_A);
      expect(result).toBe(TOKEN_A);
    });
  });

  describe("isNativeToken", () => {
    it("should return true for 'native'", () => {
      expect(isNativeToken("native")).toBe(true);
    });

    it("should return true for 'eth'", () => {
      expect(isNativeToken("eth")).toBe(true);
    });

    it("should return true for address(0)", () => {
      expect(isNativeToken(NATIVE_ETH)).toBe(true);
    });

    it("should return false for token addresses", () => {
      expect(isNativeToken(TOKEN_A)).toBe(false);
    });
  });

  describe("buildPoolKey", () => {
    it("should sort tokens correctly (lower address first)", () => {
      // TOKEN_A < TOKEN_B
      const poolKey = buildPoolKey(TOKEN_B, TOKEN_A, DEFAULT_FEE);
      expect(poolKey.currency0.toLowerCase()).toBe(TOKEN_A.toLowerCase());
      expect(poolKey.currency1.toLowerCase()).toBe(TOKEN_B.toLowerCase());
    });

    it("should preserve original order when already sorted", () => {
      // TOKEN_A < TOKEN_B
      const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);
      expect(poolKey.currency0.toLowerCase()).toBe(TOKEN_A.toLowerCase());
      expect(poolKey.currency1.toLowerCase()).toBe(TOKEN_B.toLowerCase());
    });

    it("should use default fee and no hooks", () => {
      const poolKey = buildPoolKey(TOKEN_A, TOKEN_B);
      expect(poolKey.fee).toBe(DEFAULT_FEE);
      expect(poolKey.hooks).toBe(NATIVE_ETH);
    });

    it("should allow custom fee and hooks", () => {
      const HOOKS_ADDRESS = "0x1111111111111111111111111111111111111111" as `0x${string}`;
      const CUSTOM_FEE = 500; // 0.05%
      const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, CUSTOM_FEE, HOOKS_ADDRESS);
      expect(poolKey.fee).toBe(CUSTOM_FEE);
      expect(poolKey.hooks).toBe(HOOKS_ADDRESS);
      expect(poolKey.tickSpacing).toBe(10); // 0.05% tier
    });

    it("should throw for invalid fee tier", () => {
      expect(() => buildPoolKey(TOKEN_A, TOKEN_B, 12345)).toThrow("Invalid fee tier");
    });
  });

  describe("computePoolId", () => {
    it("should compute consistent pool IDs", () => {
      const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);
      const poolId1 = computePoolId(poolKey);
      const poolId2 = computePoolId(poolKey);
      expect(poolId1).toBe(poolId2);
    });

    it("should compute different IDs for different pools", () => {
      const poolKey1 = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);
      const poolKey2 = buildPoolKey(TOKEN_A, TOKEN_B, 500); // Different fee
      expect(computePoolId(poolKey1)).not.toBe(computePoolId(poolKey2));
    });
  });

  describe("getSwapDirection", () => {
    const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);

    it("should return true when swapping currency0", () => {
      // If TOKEN_A is currency0, then swapping TOKEN_A is zeroForOne = true
      const isZeroForOne = getSwapDirection(poolKey.currency0, poolKey);
      expect(isZeroForOne).toBe(true);
    });

    it("should return false when swapping currency1", () => {
      // If TOKEN_B is currency1, then swapping TOKEN_B is zeroForOne = false
      const isZeroForOne = getSwapDirection(poolKey.currency1, poolKey);
      expect(isZeroForOne).toBe(false);
    });
  });

  describe("applySlippage", () => {
    it("should calculate minimum output correctly", () => {
      const amount = 10000n; // 10000 units
      const result = applySlippage(amount, 0.5, true); // 0.5% slippage, minimum
      // 10000 * (1 - 0.005) = 10000 * 0.995 = 9950
      expect(result).toBe(9950n);
    });

    it("should calculate maximum input correctly", () => {
      const amount = 10000n;
      const result = applySlippage(amount, 0.5, false); // 0.5% slippage, maximum
      // 10000 * (1 + 0.005) = 10000 * 1.005 = 10050
      expect(result).toBe(10050n);
    });

    it("should handle 0% slippage for minimum", () => {
      const amount = 10000n;
      const result = applySlippage(amount, 0.01, true); // 0.01% minimum
      expect(result).toBe(9999n); // 10000 * 0.9999 = 9999
    });

    it("should handle 50% slippage", () => {
      const amount = 10000n;
      const result = applySlippage(amount, 50, true);
      expect(result).toBe(5000n); // 10000 * 0.5 = 5000
    });

    // SECURITY FIX: Overflow protection test
    it("should throw for amounts exceeding maximum safe value", () => {
      const hugeAmount = BigInt("340282366920938463463374607431768211456"); // 2^128
      expect(() => applySlippage(hugeAmount, 1, true)).toThrow("Amount exceeds maximum safe value");
    });

    it("should accept amounts at the maximum safe value", () => {
      const maxAmount = BigInt("340282366920938463463374607431768211455"); // 2^128 - 1
      // Should not throw
      const result = applySlippage(maxAmount, 1, true);
      expect(result).toBeLessThan(maxAmount);
    });

    it("should handle realistic token amounts", () => {
      // 1 ETH = 10^18 wei
      const oneEth = 1000000000000000000n;
      const result = applySlippage(oneEth, 0.5, true);
      // 1 ETH * 0.995 = 0.995 ETH
      expect(result).toBe(995000000000000000n);
    });

    it("should handle very large but safe token amounts", () => {
      // 1 billion tokens with 18 decimals
      const oneBillionTokens = 1000000000n * 1000000000000000000n; // 10^27
      const result = applySlippage(oneBillionTokens, 1, true);
      expect(result).toBe(990000000000000000000000000n); // ~990M tokens worth
    });
  });

  describe("encode functions", () => {
    const mockPoolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);

    describe("encodeSwapExactInSingle", () => {
      it("should encode swap parameters", () => {
        const encoded = encodeSwapExactInSingle(mockPoolKey, true, 1000n, 995n);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
        expect(encoded.length).toBeGreaterThan(2);
      });
    });

    describe("encodeSwapExactOutSingle", () => {
      it("should encode swap parameters", () => {
        const encoded = encodeSwapExactOutSingle(mockPoolKey, true, 1000n, 1005n);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
        expect(encoded.length).toBeGreaterThan(2);
      });
    });

    describe("encodeSettleAll", () => {
      it("should encode settle parameters", () => {
        const encoded = encodeSettleAll(TOKEN_A, 1000n);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
      });
    });

    describe("encodeTakeAll", () => {
      it("should encode take parameters without recipient", () => {
        const encoded = encodeTakeAll(TOKEN_B, 1000n);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
      });

      it("should encode take parameters with recipient", () => {
        const encoded = encodeTakeAll(TOKEN_B, 1000n, RECIPIENT);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
        // With recipient, encoding should be longer (includes address)
        const encodedWithoutRecipient = encodeTakeAll(TOKEN_B, 1000n);
        expect(encoded.length).toBeGreaterThan(encodedWithoutRecipient.length);
      });
    });

    describe("encodeV4SwapInput", () => {
      it("should encode V4 swap input with multiple actions", () => {
        const actions = [0x06, 0x0c, 0x0f]; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
        const params = [
          "0x1234" as `0x${string}`,
          "0x5678" as `0x${string}`,
          "0x9abc" as `0x${string}`,
        ];
        const encoded = encodeV4SwapInput(actions, params);
        expect(encoded).toMatch(/^0x[a-f0-9]+$/);
      });
    });
  });

  describe("buildExactInputSwapData", () => {
    const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);

    it("should build swap data without recipient", () => {
      const result = buildExactInputSwapData(poolKey, true, 1000n, 995n, 1234567890n);
      expect(result.commands).toBe("0x10");
      expect(result.inputs).toHaveLength(1);
      expect(result.deadline).toBe(1234567890n);
    });

    it("should build swap data with recipient", () => {
      const result = buildExactInputSwapData(poolKey, true, 1000n, 995n, 1234567890n, RECIPIENT);
      expect(result.commands).toBe("0x10");
      expect(result.inputs).toHaveLength(1);
    });
  });

  describe("buildExactOutputSwapData", () => {
    const poolKey = buildPoolKey(TOKEN_A, TOKEN_B, DEFAULT_FEE);

    it("should build swap data without recipient", () => {
      const result = buildExactOutputSwapData(poolKey, true, 1000n, 1005n, 1234567890n);
      expect(result.commands).toBe("0x10");
      expect(result.inputs).toHaveLength(1);
      expect(result.deadline).toBe(1234567890n);
    });

    it("should build swap data with recipient", () => {
      const result = buildExactOutputSwapData(poolKey, true, 1000n, 1005n, 1234567890n, RECIPIENT);
      expect(result.commands).toBe("0x10");
      expect(result.inputs).toHaveLength(1);
    });
  });

  describe("formatTokenAmount", () => {
    it("should format small amounts correctly", () => {
      // 1.5 ETH
      const amount = 1500000000000000000n;
      const formatted = formatTokenAmount(amount, 18);
      expect(formatted).toContain("1.5");
    });

    it("should format large amounts with commas", () => {
      // 1,000,000 tokens with 6 decimals
      const amount = 1000000n * 1000000n;
      const formatted = formatTokenAmount(amount, 6);
      expect(formatted).toContain(",");
    });

    it("should handle custom max decimals", () => {
      const amount = 123456789n; // 123.456789 USDC
      const formatted = formatTokenAmount(amount, 6, 2);
      // Should have at most 2 decimal places
      expect(formatted.split(".")[1]?.length || 0).toBeLessThanOrEqual(2);
    });
  });
});
