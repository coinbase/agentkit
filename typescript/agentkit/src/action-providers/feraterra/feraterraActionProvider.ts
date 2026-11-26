import { createHmac } from "crypto";
import { z } from "zod";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_NETWORK_ID,
  DEFAULT_FERATERRA_BASE_URL,
  LOTS_PER_UNIT,
  MICRO_PER_USD,
  TICKS_PER_USD,
} from "./constants";
import {
  GetLeaderboardSchema,
  GetMarketsSchema,
  GetOrderbookSchema,
  PreviewOrderSchema,
  RequestTestnetFaucetSchema,
} from "./schemas";
import {
  FeraterraActionProviderConfig,
  FeraterraFaucetResponse,
  FeraterraLeaderboardResponse,
  FeraterraMarketsResponse,
  FeraterraNormalizedBookLevel,
  FeraterraOrderbookResponse,
  FeraterraOrderPreviewResponse,
  FeraterraRawBookLevel,
} from "./types";

/**
 * Extracts a human-readable message from an unknown error value.
 *
 * @param error - The caught error value.
 * @returns A readable error string.
 */
function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Converts fixed-point price ticks (1 tick = $0.01) to a USD decimal string.
 *
 * @param ticks - Price in fixed-point ticks.
 * @returns Formatted USD price string with 2 decimals.
 */
function ticksToUsd(ticks: number): string {
  return (ticks / TICKS_PER_USD).toFixed(2);
}

/**
 * Converts fixed-point quantity lots (1 lot = 0.0001 units) to a unit decimal string.
 *
 * @param lots - Quantity in fixed-point lots.
 * @returns Formatted base-unit quantity string with 4 decimals.
 */
function lotsToUnits(lots: number): string {
  return (lots / LOTS_PER_UNIT).toFixed(4);
}

/**
 * Normalizes a raw L2 orderbook level tuple or object into a structured level.
 *
 * @param level - Raw L2 level from GET /book.
 * @returns Normalized L2 level with fixed-point and human-readable fields.
 */
function normalizeBookLevel(level: FeraterraRawBookLevel): FeraterraNormalizedBookLevel {
  if (Array.isArray(level)) {
    const priceTicks = Number(level[0] ?? 0);
    const qtyLots = Number(level[1] ?? 0);
    const orderCount = Number(level[2] ?? 1);
    return {
      priceTicks,
      priceUsd: ticksToUsd(priceTicks),
      qtyLots,
      qtyUnits: lotsToUnits(qtyLots),
      orderCount,
    };
  }

  return {
    priceTicks: level.price_ticks,
    priceUsd: ticksToUsd(level.price_ticks),
    qtyLots: level.qty_lots,
    qtyUnits: lotsToUnits(level.qty_lots),
    orderCount: level.order_count ?? 1,
  };
}

/**
 * Builds HMAC-SHA256 authentication headers for FeraTerra HTTP endpoints.
 *
 * @param apiKey - FeraTerra API key.
 * @param apiSecret - FeraTerra API secret.
 * @param method - Uppercase HTTP method (e.g. POST).
 * @param path - Request path and query string (e.g. /order/preview).
 * @param body - Serialized JSON request body.
 * @returns HTTP headers record including HMAC signature.
 */
function buildHmacHeaders(
  apiKey: string,
  apiSecret: string,
  method: string,
  path: string,
  body: string,
): Record<string, string> {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`;
  const signature = createHmac("sha256", apiSecret).update(payload).digest("hex");
  return {
    "Content-Type": "application/json",
    "X-Arena-API-Key": apiKey,
    "X-Arena-Timestamp": timestamp,
    "X-Arena-Signature": signature,
  };
}

/**
 * FeraterraActionProvider enables AI agents to query FeraTerra headless CLOB markets,
 * L2 orderbooks, Gladiator leaderboard rankings, stateless order previews, and Base
 * Sepolia testnet collateral faucet drips.
 */
export class FeraterraActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly accountId?: number;

  /**
   * Constructs a new FeraterraActionProvider instance.
   *
   * @param config - Optional gateway URL and API credential configuration.
   */
  constructor(config: FeraterraActionProviderConfig = {}) {
    super("feraterra", []);

    const rawBaseUrl =
      config.baseUrl || process.env.FERATERRA_BASE_URL || DEFAULT_FERATERRA_BASE_URL;
    this.baseUrl = rawBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey || process.env.FERATERRA_API_KEY;
    this.apiSecret = config.apiSecret || process.env.FERATERRA_API_SECRET;

    const envAccountId = process.env.FERATERRA_ACCOUNT_ID
      ? Number(process.env.FERATERRA_ACCOUNT_ID)
      : undefined;
    this.accountId = config.accountId ?? envAccountId;
  }

  /**
   * Fetches active markets and risk parameters from FeraTerra (GET /markets).
   *
   * @param args - Optional kind and symbol filters.
   * @returns JSON string containing active markets and fixed-point risk metadata.
   */
  @CreateAction({
    name: "get_markets",
    description: `Fetch active markets and risk specifications from FeraTerra (GET /markets).

Inputs:
- kind: Optional market archetype filter ('spot', 'perp', 'spread_book', 'bounded_claim'), or null
- symbol: Optional case-insensitive symbol substring filter (e.g. 'BTC', 'ETH-USD-PERP'), or null

Fixed-point conventions:
- 1 price_tick = $0.01 USD
- 1 qty_lot = 0.0001 base units`,
    schema: GetMarketsSchema,
  })
  async getMarkets(args: z.infer<typeof GetMarketsSchema>): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/markets`);
      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error! status: ${response.status}`,
        });
      }

      const data = (await response.json()) as FeraterraMarketsResponse;
      let markets = Array.isArray(data.markets) ? data.markets : [];

      if (args.kind) {
        const kindLower = args.kind.toLowerCase();
        markets = markets.filter(market => market.kind.toLowerCase() === kindLower);
      }

      if (args.symbol) {
        const symbolLower = args.symbol.toLowerCase();
        markets = markets.filter(market => market.symbol.toLowerCase().includes(symbolLower));
      }

      const formattedMarkets = markets.map(market => ({
        marketId: market.market_id,
        symbol: market.symbol,
        kind: market.kind,
        tradingStatus: market.trading_status,
        imrBps: market.imr_bps ?? 0,
        mmrBps: market.mmr_bps ?? 0,
        makerFeeBps: market.maker_fee_bps ?? 0,
        takerFeeBps: market.taker_fee_bps ?? 0,
        markPriceTicks: market.mark_price_ticks ?? 0,
        markPriceUsd: ticksToUsd(market.mark_price_ticks ?? 0),
        bestBidTicks: market.best_bid_ticks ?? 0,
        bestBidLots: market.best_bid_lots ?? 0,
        bestAskTicks: market.best_ask_ticks ?? 0,
        bestAskLots: market.best_ask_lots ?? 0,
        restingOrders: market.resting_orders ?? 0,
      }));

      return JSON.stringify({
        success: true,
        baseUrl: this.baseUrl,
        walSeq: data.wal_seq ?? null,
        count: formattedMarkets.length,
        markets: formattedMarkets,
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error fetching FeraTerra markets: ${formatErrorMessage(error)}`,
      });
    }
  }

  /**
   * Fetches an aggregated L2 orderbook snapshot for a FeraTerra market (GET /book).
   *
   * @param args - Market ID and optional depth per side.
   * @returns JSON string containing BBO, spread, and L2 bids/asks.
   */
  @CreateAction({
    name: "get_orderbook",
    description: `Fetch aggregated L2 orderbook and BBO spread for a FeraTerra market (GET /book).

Inputs:
- marketId: Numeric market ID (e.g. 1 for BTC-USD-SPOT, 4 for BTC-USD-PERP)
- depth: Optional number of price levels per side (1-100, defaults to 20)`,
    schema: GetOrderbookSchema,
  })
  async getOrderbook(args: z.infer<typeof GetOrderbookSchema>): Promise<string> {
    try {
      const depth = args.depth ?? 20;
      const params = new URLSearchParams({
        market_id: String(args.marketId),
        depth: String(depth),
      });
      const response = await fetch(`${this.baseUrl}/book?${params.toString()}`);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error! status: ${response.status}`,
        });
      }

      const data = (await response.json()) as FeraterraOrderbookResponse;
      const rawBids = Array.isArray(data.bids) ? data.bids : [];
      const rawAsks = Array.isArray(data.asks) ? data.asks : [];
      const bids = rawBids.slice(0, depth).map(normalizeBookLevel);
      const asks = rawAsks.slice(0, depth).map(normalizeBookLevel);

      const hasBbo = data.best_bid_ticks > 0 && data.best_ask_ticks > 0;
      const spreadTicks = hasBbo ? data.best_ask_ticks - data.best_bid_ticks : null;

      return JSON.stringify({
        success: true,
        walSeq: data.wal_seq ?? null,
        marketId: data.market_id,
        symbol: data.symbol,
        kind: data.kind,
        markPriceTicks: data.mark_price_ticks,
        markPriceUsd: ticksToUsd(data.mark_price_ticks),
        bestBidTicks: data.best_bid_ticks,
        bestBidLots: data.best_bid_lots,
        bestAskTicks: data.best_ask_ticks,
        bestAskLots: data.best_ask_lots,
        spreadTicks,
        spreadUsd: spreadTicks !== null ? ticksToUsd(spreadTicks) : null,
        bids,
        asks,
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error fetching FeraTerra orderbook: ${formatErrorMessage(error)}`,
      });
    }
  }

  /**
   * Fetches the public Gladiator leaderboard from FeraTerra (GET /leaderboard).
   *
   * @param args - Optional limit and sort metric.
   * @returns JSON string containing ranked trader entries and protocol totals.
   */
  @CreateAction({
    name: "get_leaderboard",
    description: `Fetch the public FeraTerra Gladiator leaderboard (GET /leaderboard).

Inputs:
- limit: Optional maximum number of ranked traders to return (1-100, defaults to 20)
- sort: Optional ranking metric ('equity', 'pnl', 'streak', 'volume', 'roi'; default 'equity')`,
    schema: GetLeaderboardSchema,
  })
  async getLeaderboard(args: z.infer<typeof GetLeaderboardSchema>): Promise<string> {
    try {
      const limit = args.limit ?? 20;
      const sort = args.sort ?? "equity";
      const params = new URLSearchParams({
        limit: String(limit),
        sort,
      });
      const response = await fetch(`${this.baseUrl}/leaderboard?${params.toString()}`);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error! status: ${response.status}`,
        });
      }

      const data = (await response.json()) as FeraterraLeaderboardResponse;

      return JSON.stringify({
        success: true,
        walSeq: data.wal_seq ?? null,
        chainId: data.chain_id ?? BASE_SEPOLIA_CHAIN_ID,
        clearinghouseAddress: data.clearinghouse_address ?? null,
        sortBy: data.sort_by ?? sort,
        totalTraders: data.total_traders ?? 0,
        totalTrades: data.total_trades ?? 0,
        entries: Array.isArray(data.entries) ? data.entries : [],
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error fetching FeraTerra leaderboard: ${formatErrorMessage(error)}`,
      });
    }
  }

  /**
   * Runs a stateless zero-mutation order preview via POST /order/preview when API
   * credentials are configured, or simulates BBO spread and L2 sweep execution
   * from GET /book in zero-config mode.
   *
   * @param args - Order preview parameters.
   * @returns JSON string with estimated fill, resting lots, slippage, and fees.
   */
  @CreateAction({
    name: "preview_order",
    description: `Preview an order on FeraTerra with zero state mutation.
Uses POST /order/preview when API credentials are configured, or simulates BBO/L2 sweep from /book.

Inputs:
- marketId: Numeric market ID (e.g. 1 for BTC-USD-SPOT, 4 for BTC-USD-PERP)
- side: Order side ('bid', 'ask', 'buy', or 'sell')
- qtyLots: Quantity in fixed-point lots (1 lot = 0.0001 base units)
- priceTicks: Limit price in ticks (1 tick = $0.01 USD), or null when isMarket is true
- tif: Optional time-in-force ('gtc', 'ioc', 'fok', 'post_only'; defaults to 'gtc')
- isMarket: Optional boolean for market sweep simulation (defaults to false)
- reduceOnly: Optional boolean for reduce-only orders (defaults to false)
- accountId: Optional numeric trader account ID for authenticated POST /order/preview`,
    schema: PreviewOrderSchema,
  })
  async previewOrder(args: z.infer<typeof PreviewOrderSchema>): Promise<string> {
    try {
      const isMarket = args.isMarket ?? false;
      const tif = args.tif ?? "gtc";
      const reduceOnly = args.reduceOnly ?? false;

      if (!isMarket && args.priceTicks === null) {
        return JSON.stringify({
          success: false,
          error: "priceTicks is required when isMarket is false.",
        });
      }

      const isBuy = args.side === "bid" || args.side === "buy";
      const normalizedSide = isBuy ? "bid" : "ask";
      const resolvedAccountId = args.accountId ?? this.accountId;

      if (this.apiKey && this.apiSecret && resolvedAccountId) {
        const path = "/order/preview";
        const bodyObj = {
          account_id: resolvedAccountId,
          market_id: args.marketId,
          side: normalizedSide,
          price_ticks: args.priceTicks ?? 0,
          qty_lots: args.qtyLots,
          tif,
          is_market: isMarket,
          reduce_only: reduceOnly,
        };
        const body = JSON.stringify(bodyObj);
        const headers = buildHmacHeaders(this.apiKey, this.apiSecret, "POST", path, body);
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers,
          body,
        });

        if (!response.ok) {
          return JSON.stringify({
            success: false,
            error: `HTTP error! status: ${response.status}`,
          });
        }

        const preview = (await response.json()) as FeraterraOrderPreviewResponse;
        return JSON.stringify({
          success: true,
          mode: "authenticated_margin_preview",
          preview,
        });
      }

      const bookResponse = await fetch(`${this.baseUrl}/book?market_id=${args.marketId}&depth=20`);
      if (!bookResponse.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error! status: ${bookResponse.status}`,
        });
      }

      const book = (await bookResponse.json()) as FeraterraOrderbookResponse;
      const contraRaw = isBuy ? book.asks : book.bids;
      const contraLevels = (Array.isArray(contraRaw) ? contraRaw : []).map(normalizeBookLevel);

      let remainingLots = args.qtyLots;
      let filledLots = 0;
      let notionalMicro = 0;

      for (const level of contraLevels) {
        const limitTicks = args.priceTicks as number;
        const levelTicks = level.priceTicks;
        const limitCrosses = isBuy ? limitTicks >= levelTicks : limitTicks <= levelTicks;
        if (!isMarket && !limitCrosses) {
          break;
        }
        const takeLots = Math.min(remainingLots, level.qtyLots);
        filledLots += takeLots;
        notionalMicro += takeLots * levelTicks;
        remainingLots -= takeLots;
        if (remainingLots === 0) {
          break;
        }
      }

      const wouldCrossSpread = filledLots > 0;
      let status = "ok";
      let estimatedFilledLots = filledLots;
      let estimatedRestingLots = 0;

      if (tif === "post_only" && wouldCrossSpread) {
        status = "would_reject_post_only";
        estimatedFilledLots = 0;
        notionalMicro = 0;
      } else if (tif === "fok" && remainingLots > 0) {
        status = "would_reject_fok_incomplete";
        estimatedFilledLots = 0;
        notionalMicro = 0;
      } else if (!isMarket && tif !== "ioc") {
        estimatedRestingLots = remainingLots;
      }

      const estimatedAvgPriceTicks =
        estimatedFilledLots > 0 ? Math.round(notionalMicro / estimatedFilledLots) : null;
      const takerFeeBps = book.taker_fee_bps ?? 0;
      const estimatedFeeMicro = Math.floor((notionalMicro * takerFeeBps) / 10_000);
      const hasBbo = book.best_bid_ticks > 0 && book.best_ask_ticks > 0;
      const spreadTicks = hasBbo ? book.best_ask_ticks - book.best_bid_ticks : null;

      return JSON.stringify({
        success: true,
        mode: "orderbook_bbo_preview",
        stateless: true,
        marketId: book.market_id,
        symbol: book.symbol,
        side: normalizedSide,
        tif,
        isMarket,
        status,
        qtyLots: args.qtyLots,
        priceTicks: args.priceTicks,
        markPriceTicks: book.mark_price_ticks,
        bestBidTicks: book.best_bid_ticks,
        bestAskTicks: book.best_ask_ticks,
        spreadTicks,
        wouldCrossSpread,
        estimatedFilledLots,
        estimatedRestingLots,
        estimatedAvgPriceTicks,
        estimatedNotionalMicro: notionalMicro,
        estimatedNotionalUsd: (notionalMicro / MICRO_PER_USD).toFixed(2),
        estimatedFeeMicro,
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error previewing FeraTerra order: ${formatErrorMessage(error)}`,
      });
    }
  }

  /**
   * Requests Base Sepolia (chain_id=84532) testnet collateral tokens from FeraTerra (POST /faucet).
   *
   * @param walletProvider - The connected EVM wallet provider on Base Sepolia.
   * @param args - Optional asset, amount, gas drip, and recipient override.
   * @returns JSON string with the testnet faucet mint receipt or error details.
   */
  @CreateAction({
    name: "request_testnet_faucet",
    description: `Request Base Sepolia (84532) testnet collateral from FeraTerra (POST /faucet).
Uses walletProvider.getAddress() by default when recipient is null.

Inputs:
- asset: Optional collateral symbol ('USD', 'BTC', 'ETH', 'SOL'; defaults to 'USD')
- amount: Optional human-readable token amount (defaults to '10000')
- dripGas: Optional boolean to include a Base Sepolia ETH gas drip (defaults to true)
- recipient: Optional recipient EVM address; leave null to use the connected wallet address`,
    schema: RequestTestnetFaucetSchema,
  })
  async requestTestnetFaucet(
    walletProvider: WalletProvider,
    args: z.infer<typeof RequestTestnetFaucetSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const isBaseSepolia =
        network.networkId === BASE_SEPOLIA_NETWORK_ID ||
        String(network.chainId) === String(BASE_SEPOLIA_CHAIN_ID);

      if (network.protocolFamily !== "evm" || !isBaseSepolia) {
        return JSON.stringify({
          success: false,
          error: "FeraTerra faucet requires an EVM wallet on Base Sepolia (chain_id=84532).",
        });
      }

      const recipient = args.recipient || walletProvider.getAddress();
      const asset = args.asset ?? "USD";
      const amount = args.amount ?? "10000";
      const dripGas = args.dripGas ?? true;

      const response = await fetch(`${this.baseUrl}/faucet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient,
          asset,
          amount,
          drip_gas: dripGas,
          chain_id: BASE_SEPOLIA_CHAIN_ID,
        }),
      });

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error! status: ${response.status}`,
        });
      }

      const data = (await response.json()) as FeraterraFaucetResponse;
      return JSON.stringify({
        success: true,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        recipient,
        asset,
        amount,
        dripGas,
        receipt: data,
      });
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error requesting FeraTerra testnet faucet: ${formatErrorMessage(error)}`,
      });
    }
  }

  /**
   * Checks whether the FeraTerra action provider supports the given network.
   * Market discovery, orderbooks, leaderboard, and previews are network-agnostic;
   * Base Sepolia network validation is enforced inside requestTestnetFaucet.
   *
   * @param _ - The network to check.
   * @returns True for all networks.
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }
}

/**
 * Factory function to create a new FeraterraActionProvider instance.
 *
 * @param config - Optional gateway URL and API credential configuration.
 * @returns A new FeraterraActionProvider instance.
 */
export const feraterraActionProvider = (config: FeraterraActionProviderConfig = {}) =>
  new FeraterraActionProvider(config);
