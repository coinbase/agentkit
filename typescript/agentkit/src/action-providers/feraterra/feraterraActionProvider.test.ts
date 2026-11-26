import { WalletProvider } from "../../wallet-providers";
import { BASE_SEPOLIA_CHAIN_ID, DEFAULT_FERATERRA_BASE_URL } from "./constants";
import { FeraterraActionProvider, feraterraActionProvider } from "./feraterraActionProvider";

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

describe("FeraterraActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  let provider: FeraterraActionProvider;

  const mockWallet = {
    getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-sepolia",
      chainId: "84532",
    }),
    getName: jest.fn().mockReturnValue("test-wallet"),
  } as unknown as WalletProvider;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.FERATERRA_BASE_URL;
    delete process.env.FERATERRA_API_KEY;
    delete process.env.FERATERRA_API_SECRET;
    delete process.env.FERATERRA_ACCOUNT_ID;

    (mockWallet.getAddress as jest.Mock).mockReturnValue(MOCK_ADDRESS);
    (mockWallet.getNetwork as jest.Mock).mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-sepolia",
      chainId: "84532",
    });
    (mockWallet.getName as jest.Mock).mockReturnValue("test-wallet");

    provider = feraterraActionProvider();
  });

  describe("initialization and supportsNetwork", () => {
    it("should default baseUrl to https://testnet.feraterra.app and strip trailing slashes", () => {
      const custom = feraterraActionProvider({ baseUrl: "https://testnet.feraterra.app///" });
      expect(custom["baseUrl"]).toBe(DEFAULT_FERATERRA_BASE_URL);
    });

    it("should support all networks at the provider level", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(true);
    });
  });

  describe("getMarkets", () => {
    const mockMarketsPayload = {
      ok: true,
      wal_seq: 315000,
      markets: [
        {
          market_id: 1,
          symbol: "BTC-USD-SPOT",
          kind: "spot",
          trading_status: "live",
          imr_bps: 10000,
          mmr_bps: 10000,
          maker_fee_bps: 0,
          taker_fee_bps: 0,
          mark_price_ticks: 6045000,
          best_bid_ticks: 6044900,
          best_bid_lots: 250,
          best_ask_ticks: 6045100,
          best_ask_lots: 300,
          resting_orders: 4,
        },
        {
          market_id: 4,
          symbol: "BTC-USD-PERP",
          kind: "perp",
          trading_status: "live",
          imr_bps: 500,
          mmr_bps: 250,
          maker_fee_bps: 0,
          taker_fee_bps: 0,
          mark_price_ticks: 6046000,
          best_bid_ticks: 6045800,
          best_bid_lots: 500,
          best_ask_ticks: 6046200,
          best_ask_lots: 500,
          resting_orders: 2,
        },
      ],
    };

    it("should return all markets when no filters are supplied", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarketsPayload,
      });

      const result = await provider.getMarkets({ kind: null, symbol: null });
      const parsed = JSON.parse(result);

      expect(fetchMock).toHaveBeenCalledWith("https://testnet.feraterra.app/markets");
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
      expect(parsed.markets[0].symbol).toBe("BTC-USD-SPOT");
      expect(parsed.markets[0].markPriceUsd).toBe("60450.00");
    });

    it("should filter markets by kind and symbol case-insensitively", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarketsPayload,
      });

      const result = await provider.getMarkets({ kind: "PERP", symbol: "btc-usd" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(1);
      expect(parsed.markets[0].marketId).toBe(4);
    });

    it("should return error JSON when GET /markets responds non-ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      const result = await provider.getMarkets({ kind: null, symbol: null });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("502");
    });
  });

  describe("getOrderbook", () => {
    it("should normalize tuple and object L2 levels and compute BBO spread", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          wal_seq: 315280,
          market_id: 4,
          symbol: "BTC-USD-PERP",
          kind: "perp",
          mark_price_ticks: 6043520,
          best_bid_ticks: 5938346,
          best_bid_lots: 500,
          best_ask_ticks: 5938746,
          best_ask_lots: 500,
          bids: [[5938346, 500, 1]],
          asks: [{ price_ticks: 5938746, qty_lots: 500, order_count: 2 }],
        }),
      });

      const result = await provider.getOrderbook({ marketId: 4, depth: 10 });
      const parsed = JSON.parse(result);

      const expectedUrl = "https://testnet.feraterra.app/book?market_id=4&depth=10";
      expect(fetchMock).toHaveBeenCalledWith(expectedUrl);
      expect(parsed.success).toBe(true);
      expect(parsed.spreadTicks).toBe(400);
      expect(parsed.spreadUsd).toBe("4.00");
      expect(parsed.bids[0]).toEqual({
        priceTicks: 5938346,
        priceUsd: "59383.46",
        qtyLots: 500,
        qtyUnits: "0.0500",
        orderCount: 1,
      });
      expect(parsed.asks[0].orderCount).toBe(2);
    });
  });

  describe("getLeaderboard", () => {
    it("should fetch ranked leaderboard entries with query params", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          wal_seq: 315300,
          chain_id: 84532,
          clearinghouse_address: "0xcF4A547dC3c77E56b2af601e72a85A5eB9760907",
          sort_by: "pnl",
          total_traders: 1,
          total_trades: 12,
          entries: [
            {
              rank: 1,
              account_id: 1010,
              wallet_masked: "0xE1E9...1Bb9",
              equity_usd: "9000.00",
              net_pnl_usd: "125.00",
              bbo_uptime_multiplier: "1.50x",
            },
          ],
        }),
      });

      const result = await provider.getLeaderboard({ limit: 5, sort: "pnl" });
      const parsed = JSON.parse(result);

      const expectedUrl = "https://testnet.feraterra.app/leaderboard?limit=5&sort=pnl";
      expect(fetchMock).toHaveBeenCalledWith(expectedUrl);
      expect(parsed.success).toBe(true);
      expect(parsed.chainId).toBe(BASE_SEPOLIA_CHAIN_ID);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].account_id).toBe(1010);
    });
  });

  describe("previewOrder", () => {
    it("should simulate L2 sweep and resting lots from GET /book in zero-config mode", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          market_id: 4,
          symbol: "BTC-USD-PERP",
          kind: "perp",
          taker_fee_bps: 10,
          mark_price_ticks: 6000000,
          best_bid_ticks: 5999000,
          best_bid_lots: 200,
          best_ask_ticks: 6000000,
          best_ask_lots: 100,
          bids: [[5999000, 200, 1]],
          asks: [[6000000, 100, 1]],
        }),
      });

      const result = await provider.previewOrder({
        marketId: 4,
        side: "buy",
        qtyLots: 150,
        priceTicks: 6000500,
        tif: "gtc",
        isMarket: false,
        reduceOnly: false,
        accountId: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.mode).toBe("orderbook_bbo_preview");
      expect(parsed.wouldCrossSpread).toBe(true);
      expect(parsed.estimatedFilledLots).toBe(100);
      expect(parsed.estimatedRestingLots).toBe(50);
      expect(parsed.estimatedAvgPriceTicks).toBe(6000000);
    });

    it("should sign and invoke POST /order/preview with API credentials", async () => {
      const authedProvider = feraterraActionProvider({
        apiKey: "test-key",
        apiSecret: "test-secret",
        accountId: 1010,
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          preview: true,
          stateless: true,
          would_accept: true,
          status: "ok",
          wal_seq: 315400,
          effective_price_ticks: 6000000,
          estimated_filled_lots: 100,
          estimated_resting_lots: 0,
          post_imr_micro: 30000000,
          post_free_margin_micro: 970000000,
        }),
      });

      const result = await authedProvider.previewOrder({
        marketId: 4,
        side: "bid",
        qtyLots: 100,
        priceTicks: 6000000,
        tif: "ioc",
        isMarket: false,
        reduceOnly: false,
        accountId: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.mode).toBe("authenticated_margin_preview");
      expect(parsed.preview.would_accept).toBe(true);

      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe("https://testnet.feraterra.app/order/preview");
      expect(calledInit.method).toBe("POST");
      expect(calledInit.headers["X-Arena-API-Key"]).toBe("test-key");
      expect(calledInit.headers["X-Arena-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should reject limit order preview when priceTicks is null", async () => {
      const result = await provider.previewOrder({
        marketId: 1,
        side: "bid",
        qtyLots: 100,
        priceTicks: null,
        tif: "gtc",
        isMarket: false,
        reduceOnly: false,
        accountId: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("priceTicks is required");
    });
  });

  describe("requestTestnetFaucet", () => {
    it("should POST /faucet on Base Sepolia using walletProvider.getAddress()", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          tx_hash: "0xabc123",
          amount: "10000",
          asset: "USD",
        }),
      });

      const result = await provider.requestTestnetFaucet(mockWallet, {
        asset: null,
        amount: null,
        dripGas: null,
        recipient: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.chainId).toBe(84532);
      expect(parsed.recipient).toBe(MOCK_ADDRESS);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://testnet.feraterra.app/faucet",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            recipient: MOCK_ADDRESS,
            asset: "USD",
            amount: "10000",
            drip_gas: true,
            chain_id: 84532,
          }),
        }),
      );
    });

    it("should reject faucet requests when wallet is not on Base Sepolia", async () => {
      (mockWallet.getNetwork as jest.Mock).mockReturnValueOnce({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      });

      const result = await provider.requestTestnetFaucet(mockWallet, {
        asset: "USD",
        amount: "10000",
        dripGas: true,
        recipient: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Base Sepolia");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
