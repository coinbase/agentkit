import { EvmWalletProvider } from "../../wallet-providers";
import { FlipCoinActionProvider, flipcoinActionProvider } from "./flipcoinActionProvider";
import { FLIPCOIN_API_BASE_URL, FLIPCOIN_API_VERSION } from "./constants";

const MOCK_API_KEY = "fc_agent_live_testkey123456789";
const MOCK_CONDITION_ID = "0x" + "a".repeat(64);
const MOCK_MARKET_ADDR = "0x1234567890123456789012345678901234567890";
const MOCK_TX_HASH = "0xdeadbeef" + "0".repeat(56);
const MOCK_SIGNATURE = ("0x" + "b".repeat(130)) as `0x${string}`;

/**
 * Create a mocked fetch that returns the queued responses in order.
 *
 * @param responses - Queue of `{ status?, body }` entries returned for successive fetch calls.
 * @returns A Jest mock function compatible with `fetch`.
 */
function createMockFetch(responses: Array<{ status?: number; body: unknown }>): jest.Mock {
  const queue = [...responses];
  return jest.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("No more mock responses queued");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/**
 * Build a lightweight `EvmWalletProvider` mock on Base mainnet.
 *
 * @returns A Jest-mocked wallet provider whose `signTypedData` returns `MOCK_SIGNATURE`.
 */
function createMockWallet(): jest.Mocked<EvmWalletProvider> {
  return {
    signTypedData: jest.fn().mockResolvedValue(MOCK_SIGNATURE),
    getAddress: jest.fn().mockReturnValue("0xowner000000000000000000000000000000000001"),
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  } as unknown as jest.Mocked<EvmWalletProvider>;
}

describe("FlipCoinActionProvider", () => {
  describe("supportsNetwork", () => {
    const provider = new FlipCoinActionProvider();

    it.each([
      ["base-mainnet", true],
      ["base-sepolia", true],
      ["ethereum-mainnet", false],
      ["arbitrum-mainnet", false],
    ])("networkId=%s -> %s", (networkId, expected) => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId, chainId: "1" })).toBe(
        expected,
      );
    });

    it("rejects non-EVM networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as never),
      ).toBe(false);
    });
  });

  describe("factory", () => {
    it("creates a provider instance", () => {
      const provider = flipcoinActionProvider({ apiKey: MOCK_API_KEY });
      expect(provider).toBeInstanceOf(FlipCoinActionProvider);
      expect(provider.name).toBe("flipcoin");
    });
  });

  describe("get_prediction_markets", () => {
    it("fetches markets and maps shape", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            markets: [
              {
                id: "m1",
                condition_id: MOCK_CONDITION_ID,
                market_addr: MOCK_MARKET_ADDR,
                chain_id: "8453",
                title: "Will Bitcoin hit $200k in 2026?",
                description: "...",
                status: "open",
                resolved_outcome: null,
                volume_usdc: 12345,
                liquidity_usdc: 500,
                trades_count: 42,
                resolve_end_at: "2026-12-31T23:59:59Z",
                category: "crypto",
                market_version: 2,
              },
            ],
            pagination: { offset: 0, limit: 25, total: 1 },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const wallet = createMockWallet();

      const result = JSON.parse(await provider.getPredictionMarkets(wallet, {}));

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.markets[0]).toMatchObject({
        conditionId: MOCK_CONDITION_ID,
        marketAddress: MOCK_MARKET_ADDR,
        title: "Will Bitcoin hit $200k in 2026?",
        volumeUsdc: 12345,
        category: "crypto",
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${FLIPCOIN_API_BASE_URL}/api/markets?status=active&limit=25&offset=0`);
      expect((init.headers as Record<string, string>)["X-API-Version"]).toBe(FLIPCOIN_API_VERSION);
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it("passes category and custom limit", async () => {
      const mockFetch = createMockFetch([
        { body: { markets: [], pagination: { offset: 10, limit: 5, total: 0 } } },
      ]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      await provider.getPredictionMarkets(createMockWallet(), {
        category: "sports",
        limit: 5,
        offset: 10,
      });
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("category=sports");
      expect(url).toContain("limit=5");
      expect(url).toContain("offset=10");
    });

    it("returns a structured error on fetch failure", async () => {
      const mockFetch = createMockFetch([{ status: 500, body: { error: "boom" } }]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const result = JSON.parse(await provider.getPredictionMarkets(createMockWallet(), {}));
      expect(result.success).toBe(false);
      expect(result.error).toContain("boom");
    });
  });

  describe("get_market_odds", () => {
    it("fetches a firm quote and exposes percent prices", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            quoteId: "q-1",
            conditionId: MOCK_CONDITION_ID,
            side: "yes",
            action: "buy",
            amount: "5000000",
            venue: "lmsr",
            validUntil: "2026-04-23T12:00:12Z",
            lmsr: {
              available: true,
              sharesOut: "9000000",
              amountOut: "0",
              fee: "15000",
              priceYesBps: 5500,
              priceNoBps: 4500,
              newPriceYesBps: 5600,
              priceImpactBps: 100,
              avgPriceBps: 5550,
            },
            clob: { available: false, canFillFull: false, bestBidBps: null, bestAskBps: null },
            priceImpactGuard: { level: "ok", impactBps: 100, maxAllowedImpactBps: 1500 },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = JSON.parse(
        await provider.getMarketOdds(createMockWallet(), {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          action: "buy",
          amount: "5",
        }),
      );

      expect(result.success).toBe(true);
      expect(result.prices.yesPercent).toBe(55);
      expect(result.prices.noPercent).toBe(45);
      expect(result.lmsr.sharesOut).toBe("9000000");
      expect(result.priceImpactGuard.level).toBe("ok");
      expect(result.simulated.amountType).toBe("usdc");

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("amount=5000000");
      expect(url).toContain("side=yes");
      expect(url).toContain("action=buy");
    });

    it("treats amount as shares when action=sell", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            quoteId: "q-sell",
            conditionId: MOCK_CONDITION_ID,
            side: "yes",
            action: "sell",
            amount: "3000000",
            venue: "lmsr",
            validUntil: "2026-04-23T12:00:12Z",
            lmsr: {
              available: true,
              sharesOut: "0",
              amountOut: "1500000",
              fee: "5000",
              priceYesBps: 5000,
              priceNoBps: 5000,
              newPriceYesBps: 4900,
              priceImpactBps: 20,
              avgPriceBps: 4990,
            },
            clob: { available: false, canFillFull: false, bestBidBps: null, bestAskBps: null },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const result = JSON.parse(
        await provider.getMarketOdds(createMockWallet(), {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          action: "sell",
          amount: "3",
        }),
      );
      expect(result.simulated.amountType).toBe("shares");
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("action=sell");
      expect(url).toContain("amount=3000000");
    });

    it("defaults to a 1-unit simulation when amount is omitted", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            quoteId: "q-2",
            conditionId: MOCK_CONDITION_ID,
            side: "yes",
            action: "buy",
            amount: "1000000",
            venue: "lmsr",
            validUntil: "2026-04-23T12:00:12Z",
            lmsr: {
              available: true,
              sharesOut: "0",
              amountOut: "0",
              fee: "0",
              priceYesBps: 5000,
              priceNoBps: 5000,
              newPriceYesBps: 5000,
              priceImpactBps: 0,
              avgPriceBps: 5000,
            },
            clob: { available: false, canFillFull: false, bestBidBps: null, bestAskBps: null },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      await provider.getMarketOdds(createMockWallet(), { conditionId: MOCK_CONDITION_ID });
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("amount=1000000");
    });
  });

  describe("buy_prediction_shares", () => {
    const intentBody = {
      intentId: "intent-123",
      status: "awaiting_relay",
      venue: "lmsr",
      quote: {
        sharesOut: "9000000",
        avgPriceBps: 5550,
        priceImpactBps: 100,
        fee: "15000",
      },
      typedData: {
        domain: {
          name: "FlipCoin BackstopRouter",
          version: "1",
          chainId: 8453,
          verifyingContract: "0x0000000000000000000000000000000000000001",
        },
        types: {
          TradeIntent: [
            { name: "trader", type: "address" },
            { name: "signer", type: "address" },
            { name: "conditionId", type: "bytes32" },
            { name: "side", type: "uint8" },
            { name: "isBuy", type: "bool" },
            { name: "amount", type: "uint256" },
            { name: "minOut", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "maxFeeBps", type: "uint256" },
          ],
        },
        primaryType: "TradeIntent",
        message: {
          trader: "0xowner000000000000000000000000000000000001",
          signer: "0xowner000000000000000000000000000000000001",
          conditionId: MOCK_CONDITION_ID,
          side: 0,
          isBuy: true,
          amount: "5000000",
          minOut: "8910000",
          deadline: "9999999999",
          nonce: "1",
          maxFeeBps: "300",
        },
      },
      balanceCheck: { sufficient: true, required: "5000000", available: "10000000" },
      priceImpactGuard: { level: "ok", impactBps: 100, maxAllowedImpactBps: 1500 },
    };

    it("signs typed data and returns confirmed tx on happy path", async () => {
      const mockFetch = createMockFetch([
        { body: intentBody },
        {
          body: {
            intentId: "intent-123",
            status: "confirmed",
            venue: "lmsr",
            txHash: MOCK_TX_HASH,
            sharesOut: "9000000",
            usdcOut: null,
            feeUsdc: "15000",
            error: null,
            retryable: false,
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const wallet = createMockWallet();

      const result = JSON.parse(
        await provider.buyPredictionShares(wallet, {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          amountUsdc: "5",
        }),
      );

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(result.sharesOut).toBe("9000000");
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
      expect(wallet.signTypedData).toHaveBeenCalledWith(intentBody.typedData);

      const intentCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const intentReq = JSON.parse(intentCall[1].body as string);
      expect(intentReq.action).toBe("buy");
      expect(intentReq.usdcAmount).toBe("5000000");
      expect(intentReq.sharesAmount).toBeUndefined();
      expect(intentReq.maxSlippageBps).toBe(100);
      expect(intentReq.maxFeeBps).toBe(200);

      const relayCall = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(relayCall[0]).toBe(`${FLIPCOIN_API_BASE_URL}/api/agent/trade/relay`);
      const relayBody = JSON.parse(relayCall[1].body as string);
      expect(relayBody).toEqual({ intentId: "intent-123", signature: MOCK_SIGNATURE });
      expect((relayCall[1].headers as Record<string, string>).Authorization).toBe(
        `Bearer ${MOCK_API_KEY}`,
      );
    });

    it("returns structured error when approvalRequired is present on intent", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            ...intentBody,
            approvalRequired: {
              contract: "0xabc",
              function: "setApprovalForAll(address operator, bool approved)",
              operator: "0xrouter",
              approved: true,
              hint: "Approve router",
            },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const wallet = createMockWallet();
      const result = JSON.parse(
        await provider.sellPredictionShares(wallet, {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          shares: "5",
        }),
      );
      expect(result.success).toBe(false);
      expect(result.approvalRequired).toBeDefined();
      expect(result.approvalRequired.operator).toBe("0xrouter");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("aborts when price impact guard is blocked", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            ...intentBody,
            priceImpactGuard: { level: "blocked", impactBps: 5000, maxAllowedImpactBps: 3000 },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const wallet = createMockWallet();
      const result = JSON.parse(
        await provider.buyPredictionShares(wallet, {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          amountUsdc: "5",
        }),
      );
      expect(result.success).toBe(false);
      expect(result.priceImpactBps).toBe(5000);
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("requires an API key", async () => {
      const provider = new FlipCoinActionProvider({
        fetchImpl: jest.fn() as unknown as typeof fetch,
      });
      const result = JSON.parse(
        await provider.buyPredictionShares(createMockWallet(), {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          amountUsdc: "5",
        }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("API key required");
    });

    it("surfaces retryable relay errors", async () => {
      const mockFetch = createMockFetch([
        { body: intentBody },
        {
          status: 502,
          body: {
            intentId: "intent-123",
            status: "awaiting_relay",
            venue: "lmsr",
            error: "RPC timeout",
            retryable: true,
            errorCode: "RPC_ERROR",
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const result = JSON.parse(
        await provider.buyPredictionShares(createMockWallet(), {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          amountUsdc: "5",
        }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("RPC timeout");
    });
  });

  describe("sell_prediction_shares", () => {
    it("sends action=sell to intent endpoint", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            intentId: "intent-sell",
            status: "awaiting_relay",
            venue: "lmsr",
            quote: {
              sharesOut: "0",
              avgPriceBps: 5000,
              priceImpactBps: 10,
              fee: "5000",
            },
            typedData: {
              domain: {
                name: "FlipCoin BackstopRouter",
                version: "1",
                chainId: 8453,
                verifyingContract: "0x0000000000000000000000000000000000000001",
              },
              types: { TradeIntent: [{ name: "trader", type: "address" }] },
              primaryType: "TradeIntent",
              message: { trader: "0xowner" },
            },
            balanceCheck: { sufficient: true, required: "5000000", available: "10000000" },
            priceImpactGuard: { level: "ok", impactBps: 10, maxAllowedImpactBps: 1500 },
          },
        },
        {
          body: {
            intentId: "intent-sell",
            status: "confirmed",
            venue: "lmsr",
            txHash: MOCK_TX_HASH,
            sharesOut: null,
            usdcOut: "2475000",
            feeUsdc: "5000",
            error: null,
            retryable: false,
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const result = JSON.parse(
        await provider.sellPredictionShares(createMockWallet(), {
          conditionId: MOCK_CONDITION_ID,
          side: "yes",
          shares: "5",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.usdcOut).toBe("2475000");
      const intentCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(intentCall[1].body as string);
      expect(body.action).toBe("sell");
      expect(body.sharesAmount).toBe("5000000");
      expect(body.usdcAmount).toBeUndefined();
    });
  });

  describe("get_agent_portfolio", () => {
    it("fetches positions with auth header", async () => {
      const mockFetch = createMockFetch([
        {
          body: {
            positions: [
              {
                marketAddr: MOCK_MARKET_ADDR,
                title: "Market A",
                status: "open",
                yesShares: 10,
                noShares: 0,
                netSide: "yes",
                netShares: 10,
                avgEntryPriceUsdc: 0.5,
                currentPriceBps: 6000,
                currentValueUsdc: 6,
                pnlUsdc: 1,
                lastTradeAt: "2026-04-20T12:00:00Z",
              },
            ],
            totals: { marketsActive: 1, marketsResolved: 0 },
          },
        },
      ]);
      const provider = new FlipCoinActionProvider({
        apiKey: MOCK_API_KEY,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const result = JSON.parse(await provider.getAgentPortfolio(createMockWallet(), {}));
      expect(result.success).toBe(true);
      expect(result.positions).toHaveLength(1);
      expect(result.totals.marketsActive).toBe(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/agent/portfolio?status=all");
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${MOCK_API_KEY}`);
    });

    it("requires an API key", async () => {
      const provider = new FlipCoinActionProvider({
        fetchImpl: jest.fn() as unknown as typeof fetch,
      });
      const result = JSON.parse(await provider.getAgentPortfolio(createMockWallet(), {}));
      expect(result.success).toBe(false);
      expect(result.error).toContain("API key required");
    });
  });
});
