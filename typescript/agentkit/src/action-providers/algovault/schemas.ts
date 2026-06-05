import { z } from "zod";
import { TRADE_TIMEFRAMES, REGIME_TIMEFRAMES, EXCHANGES } from "./constants";

/**
 * Input schema for `get_trade_call` — a composite BUY/SELL/HOLD trade call.
 */
export const GetTradeCallSchema = z
  .object({
    coin: z
      .string()
      .max(20)
      .describe(
        "Asset symbol — e.g. BTC, ETH, SOL — for crypto perpetual futures, or a supported TradFi symbol.",
      ),
    timeframe: z
      .enum(TRADE_TIMEFRAMES)
      .default("15m")
      .describe("Candle timeframe (1m to 1d). Defaults to 15m intraday."),
    includeReasoning: z
      .boolean()
      .default(true)
      .describe("Include the reasoning behind the verdict (regime, trend/ranging signals)."),
    exchange: z
      .enum(EXCHANGES)
      .default("BINANCE")
      .describe("Perpetual-futures venue — BINANCE (default), HL, BYBIT, OKX, BITGET, …"),
  })
  .describe("Input for an AlgoVault composite trade call.");

/**
 * Input schema for `get_trade_signal` — identical to `get_trade_call`
 * (kept as a backward-compatibility alias).
 */
export const GetTradeSignalSchema = GetTradeCallSchema;

/**
 * Input schema for `get_market_regime` — the market-regime classifier.
 */
export const GetMarketRegimeSchema = z
  .object({
    coin: z.string().max(20).describe("Asset symbol — e.g. BTC, ETH, SOL."),
    timeframe: z
      .enum(REGIME_TIMEFRAMES)
      .default("4h")
      .describe("Candle timeframe — 1h, 4h, or 1d. Defaults to 4h."),
    exchange: z
      .enum(EXCHANGES)
      .default("HL")
      .describe("Perpetual-futures venue — HL (default), BINANCE, BYBIT, OKX, BITGET, …"),
  })
  .describe("Input for the AlgoVault market-regime classifier.");

/**
 * Input schema for `scan_funding_arb` — the cross-venue funding-arbitrage scanner.
 */
export const ScanFundingArbSchema = z
  .object({
    minSpreadBps: z
      .number()
      .min(0)
      .max(10000)
      .default(5)
      .describe("Minimum funding-rate spread, in basis points, for the cross-venue scan."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(10)
      .describe(
        "Maximum number of opportunities to return (the keyless free tier returns up to 5).",
      ),
  })
  .describe("Input for the AlgoVault cross-venue funding-arbitrage scan.");
