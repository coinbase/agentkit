import { HelmswapActionProvider, helmswapActionProvider } from "./helmswapActionProvider";
import { HelmswapQuoteSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TICKET = { v: 1, sig: "test" };

const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Builds a mock fetch Response.
 *
 * @param body - JSON body
 * @param status - HTTP status
 * @returns A mock response
 */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

const quoteBody = {
  ok: true,
  quote: {
    netOutAmount: "1650000",
    minOutNet: "1641750",
    fee: { disclosed: true, feeAmount: "2500000000000" },
  },
  priceImpact: { priceImpactPct: 0.01, buildable: true, level: "ok" },
  quoteTicket: TICKET,
  warnings: [],
};

describe("HelmSwap schema validation", () => {
  it("accepts valid input and defaults slippage to 50", () => {
    const result = HelmswapQuoteSchema.safeParse({
      sellToken: NATIVE,
      buyToken: USDC,
      sellAmount: "0.001",
      slippageBps: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slippageBps).toBe(50);
  });

  it("rejects invalid addresses and amounts", () => {
    expect(
      HelmswapQuoteSchema.safeParse({
        sellToken: "ETH",
        buyToken: USDC,
        sellAmount: "1",
        slippageBps: null,
      }).success,
    ).toBe(false);
    expect(
      HelmswapQuoteSchema.safeParse({
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "abc",
        slippageBps: null,
      }).success,
    ).toBe(false);
  });

  it("rejects slippage above 1000 bps", () => {
    expect(
      HelmswapQuoteSchema.safeParse({
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "1",
        slippageBps: 5000,
      }).success,
    ).toBe(false);
  });
});

describe("HelmswapActionProvider", () => {
  let provider: HelmswapActionProvider;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    provider = helmswapActionProvider();
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      readContract: jest.fn().mockResolvedValue(6),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("supports chains where HelmSwap builds swaps", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" } as Network)).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" } as Network)).toBe(
        true,
      );
    });

    it("does not support other chains or protocol families", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "42161" } as Network)).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm" } as Network)).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm" } as Network)).toBe(false);
    });
  });

  describe("getSwapQuote", () => {
    it("converts whole units to base units and formats the quote", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(quoteBody));

      const response = await provider.getSwapQuote(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "0.001",
        slippageBps: 50,
      });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.origin + url.pathname).toBe("https://helmswap.com/api/v1/quote");
      expect(url.searchParams.get("chainId")).toBe("8453");
      expect(url.searchParams.get("amountIn")).toBe("1000000000000000");
      expect(url.searchParams.get("slippageBps")).toBe("50");

      const parsed = JSON.parse(response);
      expect(parsed).toMatchObject({
        success: true,
        buyAmount: "1.65",
        minBuyAmount: "1.64175",
        buildable: true,
        network: "base-mainnet",
      });
      expect(parsed.fee).toEqual(quoteBody.quote.fee);
      expect(parsed).not.toHaveProperty("quoteTicket");
    });

    it("returns API errors with status and code", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "Too many requests", code: "RATE_LIMITED" }, 429),
      );

      const response = await provider.getSwapQuote(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "1",
        slippageBps: 50,
      });

      const parsed = JSON.parse(response);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("429 RATE_LIMITED");
    });
  });

  describe("executeSwap", () => {
    it("builds with the wallet as recipient, sends approvals, then the swap", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(quoteBody)).mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          dryRun: true,
          tx: { to: "0x00000000000000000000000000000000000000aa", data: "0xswap", value: "0" },
          approvals: [{ to: USDC, data: "0xapprove", value: "0" }],
          fee: { disclosed: true },
        }),
      );
      mockWalletProvider.sendTransaction
        .mockResolvedValueOnce("0xapprovalhash")
        .mockResolvedValueOnce("0xswaphash");
      mockWalletProvider.waitForTransactionReceipt
        .mockResolvedValueOnce({ status: "success" })
        .mockResolvedValueOnce({ status: "success", transactionHash: "0xswaphash" });

      const response = await provider.executeSwap(mockWalletProvider, {
        sellToken: USDC,
        buyToken: NATIVE,
        sellAmount: "5",
        slippageBps: 100,
      });

      const [buildUrl, buildInit] = mockFetch.mock.calls[1];
      expect(buildUrl).toBe("https://helmswap.com/api/v1/build-tx");
      expect(JSON.parse(buildInit.body)).toEqual({
        chainId: 8453,
        tokenIn: USDC,
        tokenOut: NATIVE,
        amountIn: "5000000",
        recipient: MOCK_ADDRESS,
        quoteTicket: TICKET,
        slippageBps: 100,
      });

      expect(mockWalletProvider.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: USDC,
        data: "0xapprove",
      });
      expect(mockWalletProvider.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: "0x00000000000000000000000000000000000000aa",
        data: "0xswap",
      });
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledWith("0xapprovalhash");

      const parsed = JSON.parse(response);
      expect(parsed).toMatchObject({
        success: true,
        approvalTxHashes: ["0xapprovalhash"],
        transactionHash: "0xswaphash",
      });
    });

    it("sends native value as a bigint", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(quoteBody)).mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tx: {
            to: "0x00000000000000000000000000000000000000aa",
            data: "0xswap",
            value: "1000000000000000",
          },
          approvals: [],
        }),
      );
      mockWalletProvider.sendTransaction.mockResolvedValueOnce("0xswaphash");

      await provider.executeSwap(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "0.001",
        slippageBps: 50,
      });

      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledWith({
        to: "0x00000000000000000000000000000000000000aa",
        data: "0xswap",
        value: 1000000000000000n,
      });
    });

    it("does not build when the price impact is not buildable", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ...quoteBody,
          priceImpact: { priceImpactPct: 40, buildable: false, level: "block" },
        }),
      );

      const response = await provider.executeSwap(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "100",
        slippageBps: 50,
      });

      expect(JSON.parse(response).success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockWalletProvider.sendTransaction).not.toHaveBeenCalled();
    });

    it("reports a failed swap transaction", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(quoteBody)).mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tx: { to: "0x00000000000000000000000000000000000000aa", data: "0xswap", value: "0" },
          approvals: [],
        }),
      );
      mockWalletProvider.sendTransaction.mockResolvedValueOnce("0xswaphash");
      mockWalletProvider.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });

      const response = await provider.executeSwap(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "0.001",
        slippageBps: 50,
      });

      const parsed = JSON.parse(response);
      expect(parsed.success).toBe(false);
      expect(parsed.transactionHash).toBe("0xswaphash");
    });

    it("returns an error when the build fails", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(quoteBody))
        .mockResolvedValueOnce(
          jsonResponse({ error: "Quote expired", code: "QUOTE_TICKET_EXPIRED" }, 409),
        );

      const response = await provider.executeSwap(mockWalletProvider, {
        sellToken: NATIVE,
        buyToken: USDC,
        sellAmount: "0.001",
        slippageBps: 50,
      });

      const parsed = JSON.parse(response);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("409");
      expect(mockWalletProvider.sendTransaction).not.toHaveBeenCalled();
    });
  });
});
