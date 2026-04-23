import { z } from "zod";
import { parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  DEFAULT_MAX_FEE_BPS,
  DEFAULT_MAX_SLIPPAGE_BPS,
  FLIPCOIN_API_BASE_URL,
  FLIPCOIN_API_VERSION,
  SUPPORTED_NETWORK_IDS,
} from "./constants";
import {
  BuySharesSchema,
  GetAgentPortfolioSchema,
  GetMarketOddsSchema,
  GetMarketsSchema,
  SellSharesSchema,
} from "./schemas";
import {
  ListMarketsResponse,
  PortfolioResponse,
  QuoteResponse,
  TradeIntentResponse,
  TradeRelayResponse,
} from "./types";

/**
 * Configuration options for {@link FlipCoinActionProvider}.
 */
export interface FlipCoinActionProviderConfig {
  /**
   * FlipCoin agent API key (format: `fc_agent_live_...`). Required for portfolio and trade actions.
   * Get one at https://www.flipcoin.fun/app/settings (Developers tab).
   */
  apiKey?: string;
  /**
   * Override the FlipCoin API base URL. Defaults to `https://www.flipcoin.fun`.
   * Useful for staging / self-hosted deployments.
   */
  baseUrl?: string;
  /**
   * Custom `fetch` implementation. Defaults to the global `fetch`.
   * Useful for testing or Node.js environments without global fetch.
   */
  fetchImpl?: typeof fetch;
}

const FALLBACK_REASON = "Unknown error";

/**
 * Action provider for FlipCoin — prediction markets on Base.
 *
 * Provides 5 actions:
 *  - `get_prediction_markets` — list tradable markets
 *  - `get_market_odds` — firm quote (YES/NO price, sharesOut, priceImpact)
 *  - `buy_prediction_shares` — buy YES or NO shares (EIP-712 signed by wallet)
 *  - `sell_prediction_shares` — sell YES or NO shares (EIP-712 signed by wallet)
 *  - `get_agent_portfolio` — agent's positions and P&L
 *
 * Trade actions use FlipCoin's two-phase intent/relay pattern: the provider requests
 * an EIP-712 `TradeIntent` from `/api/agent/trade/intent`, signs it with the supplied
 * {@link EvmWalletProvider}, and submits it to `/api/agent/trade/relay` where FlipCoin's
 * relayer broadcasts the transaction on-chain.
 */
export class FlipCoinActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  /**
   * Creates a new FlipCoin action provider.
   *
   * @param config - Provider configuration (api key, base url override, fetch override).
   */
  constructor(config: FlipCoinActionProviderConfig = {}) {
    super("flipcoin", []);
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? FLIPCOIN_API_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Lists tradable prediction markets on FlipCoin.
   *
   * @param _walletProvider - Unused (public endpoint).
   * @param args - Filters: status, category, limit, offset.
   * @returns JSON string with markets array and pagination info.
   */
  @CreateAction({
    name: "get_prediction_markets",
    description: `
Fetch a page of FlipCoin prediction markets on Base. Use this to discover markets to trade on.
Returns each market's conditionId (needed for trading), title, current YES/NO prices (as basis
points, 5000 = 50%), volume, trade count and resolution deadline. Filter by status
('active' = tradable, 'resolved' = settled). Prices reflect crowd-sourced odds.
`,
    schema: GetMarketsSchema,
  })
  async getPredictionMarkets(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetMarketsSchema>,
  ): Promise<string> {
    try {
      const params = new URLSearchParams();
      const status = args.status ?? "active";
      if (status && status !== "all") params.set("status", status);
      if (args.category) params.set("category", args.category);
      params.set("limit", String(args.limit ?? 25));
      params.set("offset", String(args.offset ?? 0));

      const data = await this.request<ListMarketsResponse>(`/api/markets?${params.toString()}`, {
        method: "GET",
      });

      const markets = data.markets.map(m => ({
        conditionId: m.condition_id,
        marketAddress: m.market_addr,
        title: m.title,
        status: m.status,
        volumeUsdc: m.volume_usdc,
        liquidityUsdc: m.liquidity_usdc,
        tradesCount: m.trades_count,
        resolvesAt: m.resolve_end_at,
        category: m.category ?? null,
      }));

      return JSON.stringify({
        success: true,
        count: markets.length,
        pagination: data.pagination,
        markets,
      });
    } catch (error) {
      return this.errorJson("Failed to fetch prediction markets", error);
    }
  }

  /**
   * Fetches the current odds and a firm quote for a specific market.
   *
   * @param _walletProvider - Unused (public endpoint).
   * @param args - conditionId plus optional side / action / amount for simulation.
   * @returns JSON string with current YES/NO prices (bps) and simulated trade result.
   */
  @CreateAction({
    name: "get_market_odds",
    description: `
Fetch current odds (YES/NO prices) and a firm quote for a FlipCoin prediction market. If you pass
an amount, the response includes sharesOut, priceImpact, and a quoteId valid for ~12 seconds
(useful to preview a trade before committing). The amount is interpreted as USDC for action='buy'
and as shares for action='sell'. Prices in basis points: 5000 = 50%.
`,
    schema: GetMarketOddsSchema,
  })
  async getMarketOdds(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetMarketOddsSchema>,
  ): Promise<string> {
    try {
      const side = args.side ?? "yes";
      const action = args.action ?? "buy";
      const amountRaw =
        args.amount && args.amount.length > 0 ? parseUnits(args.amount, 6).toString() : "1000000";

      const params = new URLSearchParams({
        conditionId: args.conditionId,
        side,
        action,
        amount: amountRaw,
      });

      const quote = await this.request<QuoteResponse>(`/api/quote?${params.toString()}`, {
        method: "GET",
      });

      return JSON.stringify({
        success: true,
        conditionId: args.conditionId,
        quoteId: quote.quoteId,
        validUntil: quote.validUntil,
        venue: quote.venue,
        simulated: {
          side,
          action,
          amount: args.amount ?? "1",
          amountType: action === "sell" ? "shares" : "usdc",
        },
        prices: {
          yesBps: quote.lmsr.priceYesBps,
          noBps: quote.lmsr.priceNoBps,
          yesPercent: quote.lmsr.priceYesBps / 100,
          noPercent: quote.lmsr.priceNoBps / 100,
        },
        lmsr: {
          sharesOut: quote.lmsr.sharesOut,
          amountOut: quote.lmsr.amountOut,
          fee: quote.lmsr.fee,
          avgPriceBps: quote.lmsr.avgPriceBps,
          priceImpactBps: quote.lmsr.priceImpactBps,
        },
        priceImpactGuard: quote.priceImpactGuard ?? null,
      });
    } catch (error) {
      return this.errorJson("Failed to fetch market odds", error);
    }
  }

  /**
   * Buys YES or NO shares in a prediction market using the full intent → sign → relay flow.
   *
   * @param walletProvider - Wallet used to sign the EIP-712 TradeIntent.
   * @param args - conditionId, side, amountUsdc, optional maxSlippageBps.
   * @returns JSON string with txHash and resulting position on success.
   */
  @CreateAction({
    name: "buy_prediction_shares",
    description: `
Buy YES or NO shares in a FlipCoin prediction market. Spends USDC from the agent's vault
(must be pre-funded). The wallet signs an EIP-712 TradeIntent which FlipCoin's relayer broadcasts
on-chain. Returns txHash and shares received. Pass maxSlippageBps (default 100 = 1%) to bound
price impact. Use get_market_odds first to preview the trade.
`,
    schema: BuySharesSchema,
  })
  async buyPredictionShares(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuySharesSchema>,
  ): Promise<string> {
    return this.executeTrade(walletProvider, {
      conditionId: args.conditionId,
      side: args.side,
      action: "buy",
      usdcAmount: parseUnits(args.amountUsdc, 6).toString(),
      humanAmount: args.amountUsdc,
      maxSlippageBps: args.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS,
    });
  }

  /**
   * Sells YES or NO shares in a prediction market using the full intent → sign → relay flow.
   *
   * @param walletProvider - Wallet used to sign the EIP-712 TradeIntent.
   * @param args - conditionId, side, shares amount, optional maxSlippageBps.
   * @returns JSON string with txHash and USDC received on success.
   */
  @CreateAction({
    name: "sell_prediction_shares",
    description: `
Sell YES or NO shares in a FlipCoin prediction market. Proceeds (USDC) go to the agent's vault.
The wallet signs an EIP-712 TradeIntent which FlipCoin's relayer broadcasts on-chain.
Returns txHash and USDC received. Requires prior approval of ShareToken transfers to the
BackstopRouter — the response will include approvalRequired details if missing.
`,
    schema: SellSharesSchema,
  })
  async sellPredictionShares(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SellSharesSchema>,
  ): Promise<string> {
    return this.executeTrade(walletProvider, {
      conditionId: args.conditionId,
      side: args.side,
      action: "sell",
      sharesAmount: parseUnits(args.shares, 6).toString(),
      humanAmount: args.shares,
      maxSlippageBps: args.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS,
    });
  }

  /**
   * Fetches the agent's current positions and P&L.
   *
   * @param _walletProvider - Unused (API-key authenticated).
   * @param args - Optional status filter.
   * @returns JSON string with positions array and totals.
   */
  @CreateAction({
    name: "get_agent_portfolio",
    description: `
Fetch the FlipCoin agent's current positions and P&L. Returns an array of open/resolved positions
with net side (yes/no), shares held, average entry price, current value and unrealized P&L (USDC).
Requires an API key with scope 'portfolio:read'.
`,
    schema: GetAgentPortfolioSchema,
  })
  async getAgentPortfolio(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentPortfolioSchema>,
  ): Promise<string> {
    try {
      this.requireApiKey("get_agent_portfolio");
      const status = args.status ?? "all";
      const params = new URLSearchParams({ status });
      const data = await this.request<PortfolioResponse>(
        `/api/agent/portfolio?${params.toString()}`,
        { method: "GET", authenticated: true },
      );

      return JSON.stringify({
        success: true,
        totals: data.totals,
        positions: data.positions,
      });
    } catch (error) {
      return this.errorJson("Failed to fetch agent portfolio", error);
    }
  }

  /**
   * FlipCoin is deployed on Base (mainnet + sepolia).
   *
   * @param network - The target network.
   * @returns True if the network is Base mainnet or Base Sepolia.
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm") return false;
    if (!network.networkId) return false;
    return (SUPPORTED_NETWORK_IDS as readonly string[]).includes(network.networkId);
  }

  /**
   * Shared intent → sign → relay flow for buy and sell actions.
   *
   * @param walletProvider - Wallet used to sign the EIP-712 TradeIntent.
   * @param params - Trade parameters.
   * @param params.conditionId - 0x-prefixed condition id of the target market.
   * @param params.side - Outcome side being traded ('yes' or 'no').
   * @param params.action - Trade direction ('buy' or 'sell').
   * @param params.usdcAmount - Raw USDC amount (6 decimals) when action='buy'.
   * @param params.sharesAmount - Raw shares amount (6 decimals) when action='sell'.
   * @param params.humanAmount - Human-readable amount for the success payload.
   * @param params.maxSlippageBps - Caller-supplied slippage tolerance in bps.
   * @returns JSON string describing the outcome (txHash on success, structured error otherwise).
   */
  private async executeTrade(
    walletProvider: EvmWalletProvider,
    params: {
      conditionId: string;
      side: "yes" | "no";
      action: "buy" | "sell";
      usdcAmount?: string;
      sharesAmount?: string;
      humanAmount: string;
      maxSlippageBps: number;
    },
  ): Promise<string> {
    try {
      this.requireApiKey(`${params.action}_prediction_shares`);

      const body: Record<string, unknown> = {
        conditionId: params.conditionId,
        side: params.side,
        action: params.action,
        maxSlippageBps: params.maxSlippageBps,
        maxFeeBps: DEFAULT_MAX_FEE_BPS,
        venue: "auto",
      };
      if (params.action === "buy") {
        body.usdcAmount = params.usdcAmount;
      } else {
        body.sharesAmount = params.sharesAmount;
      }

      const intent = await this.request<TradeIntentResponse>("/api/agent/trade/intent", {
        method: "POST",
        authenticated: true,
        body,
      });

      if (intent.priceImpactGuard.level === "blocked") {
        return JSON.stringify({
          success: false,
          error: "Price impact exceeds protocol limit — trade blocked.",
          priceImpactBps: intent.priceImpactGuard.impactBps,
          maxAllowedImpactBps: intent.priceImpactGuard.maxAllowedImpactBps,
        });
      }

      // `approvalRequired` is returned ONLY when ShareToken approval is missing.
      // The nested `approved: true` is the TARGET value for setApprovalForAll, not current state.
      if (intent.approvalRequired) {
        return JSON.stringify({
          success: false,
          error: "Approval required before selling shares",
          approvalRequired: intent.approvalRequired,
          hint: "Call ShareToken.setApprovalForAll(approvalRequired.operator, true) from the trader wallet, then retry.",
        });
      }

      const signature = (await walletProvider.signTypedData(
        intent.typedData as unknown as Parameters<EvmWalletProvider["signTypedData"]>[0],
      )) as `0x${string}`;

      const relay = await this.request<TradeRelayResponse>("/api/agent/trade/relay", {
        method: "POST",
        authenticated: true,
        body: { intentId: intent.intentId, signature },
      });

      if (relay.status === "confirmed") {
        return JSON.stringify({
          success: true,
          status: "confirmed",
          action: params.action,
          side: params.side,
          humanAmount: params.humanAmount,
          txHash: relay.txHash,
          sharesOut: relay.sharesOut,
          usdcOut: relay.usdcOut,
          feeUsdc: relay.feeUsdc,
          quote: intent.quote,
        });
      }

      return JSON.stringify({
        success: false,
        status: relay.status,
        error: relay.error ?? FALLBACK_REASON,
        errorCode: relay.errorCode,
        retryable: relay.retryable,
        intentId: relay.intentId,
      });
    } catch (error) {
      return this.errorJson(`Failed to ${params.action} prediction shares`, error);
    }
  }

  /**
   * Typed HTTP helper for the FlipCoin API. Adds version header and optional bearer auth.
   *
   * @param path - Request path (starting with `/`).
   * @param options - Request options.
   * @param options.method - HTTP method.
   * @param options.body - JSON-serialisable request body (POST only).
   * @param options.authenticated - If true, attaches the `Authorization: Bearer <apiKey>` header.
   * @returns Parsed JSON response typed as `T`.
   */
  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      authenticated?: boolean;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      "X-API-Version": FLIPCOIN_API_VERSION,
      Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.authenticated) headers.Authorization = `Bearer ${this.apiKey}`;

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const raw = await response.text();
    let json: unknown;
    try {
      json = raw.length > 0 ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `FlipCoin API returned non-JSON response (status ${response.status}): ${raw.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      const message =
        (json as { error?: string; message?: string })?.error ||
        (json as { message?: string })?.message ||
        `FlipCoin API error (status ${response.status})`;
      const errorCode = (json as { errorCode?: string })?.errorCode;
      const err = new Error(errorCode ? `${message} [${errorCode}]` : message);
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }

    return json as T;
  }

  /**
   * Throws a descriptive error when the provider was constructed without an API key.
   *
   * @param action - Name of the action that required the key (used in the error message).
   */
  private requireApiKey(action: string): void {
    if (!this.apiKey) {
      throw new Error(
        `FlipCoin API key required for '${action}'. Pass it via flipcoinActionProvider({ apiKey }). ` +
          `Create a key at https://www.flipcoin.fun/app/settings.`,
      );
    }
  }

  /**
   * Formats an exception into the provider's standard JSON error envelope.
   *
   * @param message - Human-readable prefix describing what failed.
   * @param error - The caught error or thrown value.
   * @returns A JSON string `{ success: false, error: "<message>: <details>" }`.
   */
  private errorJson(message: string, error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: `${message}: ${details}` });
  }
}

/**
 * Factory function for {@link FlipCoinActionProvider}.
 *
 * @param config - Provider configuration.
 * @returns A new FlipCoin action provider instance.
 */
export const flipcoinActionProvider = (config: FlipCoinActionProviderConfig = {}) =>
  new FlipCoinActionProvider(config);
