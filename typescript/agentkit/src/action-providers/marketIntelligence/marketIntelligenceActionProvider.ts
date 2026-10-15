import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  TradingDecisionSchema,
  TokenRiskSchema,
  NewTokensSchema,
  SwapQuoteSchema,
  ExplainMoveSchema,
  MarketRegimeSchema,
  MacroCalendarSchema,
  FuturesPositioningSchema,
  StockFundamentalsSchema,
  InsiderTradesSchema,
  DecisionTrackRecordSchema,
} from "./schemas";

export const MARKET_INTELLIGENCE_BASE_URL = "https://api.marketintelligenceapi.com";

/**
 * Configuration options for the MarketIntelligenceActionProvider.
 */
export interface MarketIntelligenceActionProviderConfig {
  /**
   * API base URL (default https://api.marketintelligenceapi.com).
   */
  baseUrl?: string;

  /**
   * Prepaid-credit API key (mi_...). When set, calls are paid from its balance instead of the wallet.
   */
  apiKey?: string;

  /**
   * Largest price one call may cost, in USD (default 0.10).
   */
  maxPriceUsd?: number;
}

/**
 * Builds a query string from the given parameters, skipping null and undefined values.
 *
 * @param params - Query parameters.
 * @returns The query string, starting with "?" when not empty.
 */
function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * Encodes one path segment.
 *
 * @param value - The raw segment.
 * @returns The encoded segment.
 */
function segment(value: string): string {
  return encodeURIComponent(value.trim());
}

/**
 * MarketIntelligenceActionProvider gives agents market data from the Market Intelligence API:
 * trading decisions with a public track record, token risk checks, new-token scans, swap quotes,
 * price-move explanations, market regime, macro calendar, CFTC futures positioning, SEC fundamentals
 * and insider trades. Each call is paid per request with x402 (USDC on Base) from the agent's wallet,
 * or from prepaid credits when an API key is configured.
 */
export class MarketIntelligenceActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly maxPriceUsd: number;
  private readonly fetchers = new WeakMap<EvmWalletProvider, typeof fetch>();

  /**
   * Creates a new MarketIntelligenceActionProvider instance.
   *
   * @param config - Optional base URL, API key and price limit.
   */
  constructor(config: MarketIntelligenceActionProviderConfig = {}) {
    super("market_intelligence", []);
    this.baseUrl = (config.baseUrl ?? MARKET_INTELLIGENCE_BASE_URL).replace(/\/$/, "");
    this.apiKey = config.apiKey ?? process.env.MARKET_INTELLIGENCE_API_KEY;
    this.maxPriceUsd = config.maxPriceUsd ?? 0.1;
  }

  /**
   * Gets a live trading decision.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Symbol and optional side.
   * @returns JSON string with the decision or an error.
   */
  @CreateAction({
    name: "get_trading_decision",
    description: `Live trading decision for a crypto pair or US stock ($0.05).
Returns an action from STRONG_BUY to STRONG_SELL, conviction, a GO/WAIT answer for the given side,
the stance of each pillar (order flow, technicals, smart money, fundamentals, insiders, perps, market risk, news)
and the measured hit rate of past decisions.`,
    schema: TradingDecisionSchema,
  })
  async getTradingDecision(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TradingDecisionSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.05,
      `/api/v1/decision/lite/${segment(args.symbol)}${query({ side: args.side })}`,
    );
  }

  /**
   * Checks a token for risks before buying it.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Token address and chain.
   * @returns JSON string with the risk report or an error.
   */
  @CreateAction({
    name: "check_token_risk",
    description: `Due diligence on a token before buying it ($0.02).
Sell simulation (honeypot), owner and admin functions, liquidity, LP burn, taxes, holder concentration,
Uniswap v4 hooks, impersonation of USDC/USDT/WETH, and a verdict LOW_RISK, CAUTION or HIGH_RISK.
EVM chains or Solana (chain=solana with a mint address).`,
    schema: TokenRiskSchema,
  })
  async checkTokenRisk(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenRiskSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.02,
      `/api/v1/intelligence/token-risk/${segment(args.address)}${query({ chain: args.chain })}`,
    );
  }

  /**
   * Lists recently launched tokens with their risk verdicts.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Chain, window and filters.
   * @returns JSON string with the tokens or an error.
   */
  @CreateAction({
    name: "find_new_tokens",
    description: `Tokens launched recently on Base or Ethereum, already risk-checked ($0.02).
New Uniswap v2/v3/v4 and Aerodrome pools with liquidity, sell simulation, v4 hook powers, token age and a verdict.
Filter verdict=LOW_RISK to keep only the safest.`,
    schema: NewTokensSchema,
  })
  async findNewTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof NewTokensSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.02,
      `/api/v1/intelligence/new-tokens${query({
        chain: args.chain,
        minutes: args.minutes,
        verdict: args.verdict,
        minLiquidityUsd: args.minLiquidityUsd,
      })}`,
    );
  }

  /**
   * Simulates a swap on the best on-chain route.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Chain, tokens and amount.
   * @returns JSON string with the quote or an error.
   */
  @CreateAction({
    name: "get_swap_quote",
    description: `What a swap returns right now on the best on-chain route ($0.002).
Uniswap v2/v3/v4 and Aerodrome, direct or via WETH, with price impact, minimum received and hook warnings.
Simulated only, nothing is executed.`,
    schema: SwapQuoteSchema,
  })
  async getSwapQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapQuoteSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.002,
      `/api/v1/intelligence/quote${query({
        chain: args.chain,
        sell: args.sell,
        buy: args.buy,
        amount: args.amount,
      })}`,
    );
  }

  /**
   * Explains why a symbol is moving.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - The symbol.
   * @returns JSON string with the drivers or an error.
   */
  @CreateAction({
    name: "explain_price_move",
    description: `Why is a symbol moving ($0.02)? The 15-minute move and its likely drivers from on-chain order flow,
unusual activity, smart money, perp crowding, news of the last 48h, SEC filings and insiders,
each with direction and weight, plus a one-sentence summary.`,
    schema: ExplainMoveSchema,
  })
  async explainPriceMove(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExplainMoveSchema>,
  ): Promise<string> {
    return this.call(walletProvider, 0.02, `/api/v1/explain/${segment(args.symbol)}`);
  }

  /**
   * Gets the current crypto market regime.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Aggregation window.
   * @returns JSON string with the regime or an error.
   */
  @CreateAction({
    name: "get_market_regime",
    description: `The current crypto market regime ($0.005): BULLISH, BEARISH or MIXED with breadth, buy pressure,
momentum, stablecoin flows, upcoming macro events and the leading assets. Use it to set risk before trading.`,
    schema: MarketRegimeSchema,
  })
  async getMarketRegime(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MarketRegimeSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.005,
      `/api/v1/intelligence/regime${query({ window: args.window })}`,
    );
  }

  /**
   * Lists upcoming macro events.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Days ahead and importance.
   * @returns JSON string with the events or an error.
   */
  @CreateAction({
    name: "get_macro_calendar",
    description: `Upcoming high-impact macro events in UTC ($0.002): CPI, jobs report, PCE, GDP, FOMC and ECB decisions.
Avoid opening positions right before them.`,
    schema: MacroCalendarSchema,
  })
  async getMacroCalendar(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MacroCalendarSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.002,
      `/api/v1/calendar${query({ days: args.days, importance: args.importance })}`,
    );
  }

  /**
   * Gets CFTC Commitments of Traders positioning.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Optional market.
   * @returns JSON string with the positioning or an error.
   */
  @CreateAction({
    name: "get_futures_positioning",
    description: `CFTC Commitments of Traders ($0.005): how futures speculators are positioned in gold, oil, S&P 500, Nasdaq,
Treasuries, dollar, euro, yen, bitcoin, ether and more, with a 3-year COT index flagging crowded longs and shorts.
Pass market=null for all 24 markets.`,
    schema: FuturesPositioningSchema,
  })
  async getFuturesPositioning(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FuturesPositioningSchema>,
  ): Promise<string> {
    const path = args.market ? `/api/v1/cot/${segment(args.market)}` : "/api/v1/cot";
    return this.call(walletProvider, 0.005, path);
  }

  /**
   * Gets fundamentals of US-listed companies.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Up to 10 tickers.
   * @returns JSON string with the fundamentals or an error.
   */
  @CreateAction({
    name: "get_stock_fundamentals",
    description: `Fundamentals of up to 10 US-listed companies from SEC filings ($0.03 per call):
revenue, earnings, margins, growth, balance sheet and a fundamental signal.`,
    schema: StockFundamentalsSchema,
  })
  async getStockFundamentals(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof StockFundamentalsSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.03,
      `/api/v1/fundamentals/batch${query({ symbols: args.symbols.join(",") })}`,
    );
  }

  /**
   * Gets insider trades of a company.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param args - Ticker and look-back.
   * @returns JSON string with the insider activity or an error.
   */
  @CreateAction({
    name: "get_insider_trades",
    description: `Are a company's insiders buying or selling ($0.01)? SEC Form 4 open-market buys and sales,
10b5-1 plans and a signal (CLUSTER_BUYING, NET_BUYING, PLANNED_SELLING, NET_SELLING).`,
    schema: InsiderTradesSchema,
  })
  async getInsiderTrades(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof InsiderTradesSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0.01,
      `/api/v1/insiders/${segment(args.symbol)}${query({ days: args.days })}`,
    );
  }

  /**
   * Gets the measured hit rates of the trading decisions (free).
   *
   * @param walletProvider - The wallet provider (no payment is made).
   * @param args - Look-back in days.
   * @returns JSON string with the track record or an error.
   */
  @CreateAction({
    name: "get_decision_track_record",
    description: `FREE: live hit rates of the trading decisions after 1h, 4h and 24h, and the measured accuracy of each pillar.
Check it before trusting a decision.`,
    schema: DecisionTrackRecordSchema,
  })
  async getDecisionTrackRecord(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DecisionTrackRecordSchema>,
  ): Promise<string> {
    return this.call(
      walletProvider,
      0,
      `/api/v1/decision/track-record${query({ days: args.days })}`,
    );
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True for EVM networks (payments settle in USDC on Base).
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Calls one route of the API, paying with the API key or with x402 from the wallet.
   *
   * @param walletProvider - The wallet paying for the call.
   * @param priceUsd - Price of the route, checked against maxPriceUsd.
   * @param path - Path and query of the route.
   * @returns JSON string with the data (and the settlement transaction) or an error.
   */
  private async call(
    walletProvider: EvmWalletProvider,
    priceUsd: number,
    path: string,
  ): Promise<string> {
    if (priceUsd > this.maxPriceUsd) {
      return JSON.stringify({
        error: true,
        message: `This call costs $${priceUsd}, above the configured maxPriceUsd of $${this.maxPriceUsd}`,
      });
    }
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.apiKey) headers["X-API-Key"] = this.apiKey;
      const doFetch = this.apiKey || priceUsd === 0 ? fetch : this.paidFetch(walletProvider);
      const response = await doFetch(this.baseUrl + path, { headers });
      const text = await response.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // not JSON, keep the text
      }
      if (!response.ok) {
        return JSON.stringify({ error: true, status: response.status, data });
      }
      return JSON.stringify({ data, transaction: this.settlementTransaction(response) });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Returns a fetch that pays 402 responses with x402 from the wallet, created once per wallet.
   *
   * @param walletProvider - The wallet signing the payments.
   * @returns The paying fetch.
   */
  private paidFetch(walletProvider: EvmWalletProvider): typeof fetch {
    let paying = this.fetchers.get(walletProvider);
    if (!paying) {
      const client = new x402Client();
      registerExactEvmScheme(client, { signer: walletProvider.toSigner() as never });
      paying = wrapFetchWithPayment(fetch, client);
      this.fetchers.set(walletProvider, paying);
    }
    return paying;
  }

  /**
   * Reads the settlement transaction from the PAYMENT-RESPONSE header, if any.
   *
   * @param response - The API response.
   * @returns The transaction hash, or undefined.
   */
  private settlementTransaction(response: Response): string | undefined {
    const header = response.headers.get("payment-response");
    if (!header) return undefined;
    try {
      return JSON.parse(Buffer.from(header, "base64").toString("utf8")).transaction;
    } catch {
      return undefined;
    }
  }
}

/**
 * Factory function to create a new MarketIntelligenceActionProvider instance.
 *
 * @param config - Optional base URL, API key and price limit.
 * @returns A new MarketIntelligenceActionProvider
 */
export const marketIntelligenceActionProvider = (config?: MarketIntelligenceActionProviderConfig) =>
  new MarketIntelligenceActionProvider(config);
