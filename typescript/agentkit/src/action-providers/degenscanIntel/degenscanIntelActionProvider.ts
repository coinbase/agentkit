import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  GetAssetBriefSchema,
  GetDeribitPerpsSchema,
  GetMarketEventsSchema,
  GetPerpDerivsSchema,
  GetPulseSchema,
} from "./schemas";

const BASE_URL = "https://intel.degenscan.io";

/**
 * Configuration for DegenscanIntelActionProvider.
 * Without an API key the provider uses the free trial (100 calls/day/IP, header X-Free-Trial: 1).
 * With `apiKey` (prepaid USDC pack or Stripe plan) it sends X-API-KEY.
 * For per-call USDC payments via x402, wrap `fetch` with @x402/fetch and pass it as `fetchFn`.
 */
export interface DegenscanIntelActionProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * DegenscanIntelActionProvider provides actions to read cross-asset market-event intelligence
 * (SEC filings, Fed/central-bank releases, regulator actions, disasters, exchange halts, DeFi hacks,
 * Polymarket odds, Hyperliquid perps) from Degenscan Intel — https://intel.degenscan.io.
 * Priced per call ($0.001–$0.10) via x402 (USDC on Base/Solana) or API key; free trial included.
 * Information and analytics only — not investment advice.
 */
export class DegenscanIntelActionProvider extends ActionProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  /**
   * Creates a new DegenscanIntelActionProvider.
   *
   * @param config - Optional API key, base URL and fetch function
   */
  constructor(config: DegenscanIntelActionProviderConfig = {}) {
    super("degenscan_intel", []);
    this.apiKey = config.apiKey ?? process.env.DEGENSCAN_INTEL_API_KEY;
    this.baseUrl = (config.baseUrl ?? BASE_URL).replace(/\/$/, "");
    this.fetchFn = config.fetchFn ?? fetch;
  }

  /**
   * Cheapest probe: counts of price-moving events in the last hour by class, high-severity count, venues open.
   *
   * @param _args - No inputs
   * @returns The JSON response as a string
   */
  @CreateAction({
    name: "get_market_pulse",
    description: `Cheapest probe ($0.001) of what happened in markets in the last hour: event counts by class (regulatory, corporate, crypto, macro, natural), number of high-severity events and which venues are open (crypto, US equities). Call it on a timer before deciding whether to fetch full events.`,
    schema: GetPulseSchema,
  })
  async getMarketPulse(_args: z.infer<typeof GetPulseSchema>): Promise<string> {
    return this.request("/v1/pulse");
  }

  /**
   * Price-moving events since a window with per-asset impacts.
   *
   * @param args - Window, asset universe, minimum confidence and limit
   * @returns The JSON response as a string
   */
  @CreateAction({
    name: "get_market_events",
    description: `Fetch price-moving market events since a time window from ~40 primary sources (SEC EDGAR filings, Federal Reserve and other central banks, Federal Register rules, FTC/DOJ/FDA/CFTC actions, USGS earthquakes, NOAA storms, Nasdaq trading halts, DeFi hacks, Polymarket repricing). Each event carries severity, novelty, corroboration count and impacts[] per asset with direction (-1/0/1), confidence (0..1) and the exposure path (e.g. quake -> TSMC fab -> TSM -> NVDA), plus tradable_now / next_open. Use it to find catalysts for assets in your book. $0.005 per call.`,
    schema: GetMarketEventsSchema,
  })
  async getMarketEvents(args: z.infer<typeof GetMarketEventsSchema>): Promise<string> {
    return this.request("/v1/events", {
      since: args.since,
      universe: args.universe,
      min_confidence: args.minConfidence,
      limit: args.limit,
    });
  }

  /**
   * One-call pre-trade brief for one asset.
   *
   * @param args - The asset id and lookback
   * @returns The JSON response as a string
   */
  @CreateAction({
    name: "get_asset_brief",
    description: `One-call pre-trade briefing for one asset (e.g. BTC, ETH, NVDA, MSTR, CL): net event pressure and its drivers, headlines with sentiment, recent SEC filings (equities), exposure map, related Polymarket markets, upcoming scheduled catalysts (FOMC, CPI, earnings), perp funding/open-interest flags (crypto) and whether the venue is open now. Use it right before sizing or explaining a position. $0.10 per call.`,
    schema: GetAssetBriefSchema,
  })
  async getAssetBrief(args: z.infer<typeof GetAssetBriefSchema>): Promise<string> {
    return this.request(`/v1/brief/${encodeURIComponent(args.assetId.toUpperCase())}`, {
      since: args.since,
    });
  }

  /**
   * Perp microstructure for one coin from Hyperliquid's public API.
   *
   * @param args - The perp coin
   * @returns The JSON response as a string
   */
  @CreateAction({
    name: "get_perp_derivs",
    description: `Perpetual-futures microstructure for one coin from Hyperliquid's public API (no key): hourly funding with 8h-equivalent and annualized %, predicted next funding by venue (Hyperliquid, Binance, Bybit), open interest in coins and USD with OI-to-volume, mark/oracle premium, 24h volume and change, and flags such as funding_hot_long, premium_rich, oi_heavy_vs_volume, joined with primary-source event pressure on the same asset. Use it to avoid crowded funding before opening a perp. $0.003 per call.`,
    schema: GetPerpDerivsSchema,
  })
  async getPerpDerivs(args: z.infer<typeof GetPerpDerivsSchema>): Promise<string> {
    return this.request(`/v1/derivs/${encodeURIComponent(args.symbol.toUpperCase())}`);
  }

  /**
   * Funding, premium, open interest and volume for Deribit perpetuals.
   *
   * @param args - Symbols, sort order and limit
   * @returns The JSON response as a string
   */
  @CreateAction({
    name: "get_deribit_perps",
    description: `Funding and positioning for every Deribit perpetual — the venue where Coinbase Advanced / Coinbase for Agents executes international perps (crypto, stocks, gold, oil): funding 8h and annualized %, mark premium over index (bp), open interest in USD, 24h volume, and the funding gap vs Hyperliquid for the same coin. Pass one symbol to also get 7 days of hourly funding history. Use it before opening or sizing a perp on Coinbase or comparing venues. $0.002 per call.`,
    schema: GetDeribitPerpsSchema,
  })
  async getDeribitPerps(args: z.infer<typeof GetDeribitPerpsSchema>): Promise<string> {
    return this.request("/v1/deribit/perps", {
      symbols: args.symbols,
      sort: args.sort,
      limit: args.limit,
    });
  }

  /**
   * Read-only HTTP provider; works on every network.
   *
   * @returns Always true
   */
  supportsNetwork = () => true;
  /**
   * Calls a Degenscan Intel route and returns the response body as text.
   *
   * @param path - The route path, e.g. /v1/pulse
   * @param query - Query parameters; arrays are joined with commas
   * @returns The JSON body as a string, or a readable error message
   */
  private async request(path: string, query: Record<string, unknown> = {}): Promise<string> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    else headers["x-free-trial"] = "1";
    const res = await this.fetchFn(url.toString(), { headers });
    const text = await res.text();
    if (res.status === 402)
      return `Payment required by ${url.pathname}: pass an apiKey (buy one with USDC: POST ${this.baseUrl}/v1/keys/x402/balance_5 for $6 of calls) or use an x402-enabled fetch.`;
    if (!res.ok) return `Error ${res.status} from Degenscan Intel: ${text.slice(0, 300)}`;
    return text;
  }
}

/**
 * Creates a Degenscan Intel action provider.
 *
 * @param config - Optional API key, base URL and fetch function
 * @returns A new DegenscanIntelActionProvider
 */
export const degenscanIntelActionProvider = (config?: DegenscanIntelActionProviderConfig) =>
  new DegenscanIntelActionProvider(config);
