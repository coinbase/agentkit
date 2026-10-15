import { z } from "zod";

const symbol = z
  .string()
  .min(1)
  .describe("Crypto pair or US stock ticker, e.g. ETHUSD, BTCUSD, NVDA, TSLA");

export const TradingDecisionSchema = z
  .object({
    symbol,
    side: z.enum(["buy", "sell"]).nullable().describe("The side you intend to trade, if any"),
  })
  .describe("Get a live trading decision for a crypto pair or US stock");

export const TokenRiskSchema = z
  .object({
    address: z.string().min(32).describe("Token contract address (0x...) or Solana mint"),
    chain: z
      .enum(["base", "ethereum", "arbitrum", "optimism", "polygon", "solana"])
      .describe("Chain the token lives on, e.g. base"),
  })
  .describe("Check a token for honeypot, owner powers, liquidity and impersonation risks");

export const NewTokensSchema = z
  .object({
    chain: z.enum(["base", "ethereum"]).describe("Chain to scan, e.g. base"),
    minutes: z.number().int().min(5).max(1440).nullable().describe("Look-back window (default 60)"),
    verdict: z
      .enum(["LOW_RISK", "CAUTION", "HIGH_RISK"])
      .nullable()
      .describe("Keep only tokens with this verdict"),
    minLiquidityUsd: z
      .number()
      .min(0)
      .nullable()
      .describe("Minimum pool liquidity in USD (default 10000)"),
  })
  .describe("List tokens launched recently, already risk-checked");

export const SwapQuoteSchema = z
  .object({
    chain: z
      .enum(["base", "ethereum", "arbitrum", "optimism", "polygon"])
      .describe("Chain, e.g. base"),
    sell: z.string().describe("ETH, WETH, USDC or a token address"),
    buy: z.string().describe("ETH, WETH, USDC or a token address"),
    amount: z.string().describe("Amount of the sell token, e.g. 100"),
  })
  .describe("Simulate a swap on the best on-chain route");

export const ExplainMoveSchema = z.object({ symbol }).describe("Explain why a symbol is moving");

export const MarketRegimeSchema = z
  .object({
    window: z.enum(["1m", "5m", "15m"]).nullable().describe("Aggregation window (default 5m)"),
  })
  .describe("Get the current crypto market regime");

export const MacroCalendarSchema = z
  .object({
    days: z.number().int().min(1).max(60).nullable().describe("Days ahead (default 14)"),
    importance: z
      .enum(["high", "medium", "all"])
      .nullable()
      .describe("Minimum importance (default high)"),
  })
  .describe("List upcoming macro events");

export const FuturesPositioningSchema = z
  .object({
    market: z
      .string()
      .nullable()
      .describe(
        "gold, wti, sp500, ust10y, eur, bitcoin (aliases GOLD, SPY, BTC work); null for all markets",
      ),
  })
  .describe("Get CFTC Commitments of Traders positioning");

export const StockFundamentalsSchema = z
  .object({
    symbols: z.array(z.string()).min(1).max(10).describe('US tickers, e.g. ["AAPL", "MSFT"]'),
  })
  .describe("Get fundamentals of US-listed companies from SEC filings");

export const InsiderTradesSchema = z
  .object({
    symbol: z.string().min(1).describe("US ticker, e.g. TSLA"),
    days: z.number().int().min(1).max(365).nullable().describe("Look-back in days (default 90)"),
  })
  .describe("Get insider buying and selling from SEC Form 4 filings");

export const DecisionTrackRecordSchema = z
  .object({
    days: z.number().int().min(1).max(30).nullable().describe("Look-back in days (default 30)"),
  })
  .describe("Get the measured hit rates of the trading decisions");
