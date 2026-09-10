/**
 * Default AlgoVault MCP endpoint (Streamable HTTP transport).
 *
 * The provider speaks MCP directly to this endpoint — the same surface every
 * AlgoVault client uses. The free tier is keyless; an optional API key unlocks
 * paid tiers.
 */
export const ALGOVAULT_MCP_URL = "https://api.algovault.com/mcp";

/**
 * Client identity reported to the AlgoVault MCP server during the handshake.
 */
export const ALGOVAULT_CLIENT_INFO = {
  name: "agentkit-algovault-action-provider",
  version: "1.0.0",
} as const;

/**
 * Supported candle timeframes for the trade-call actions (mirrors the live tool enum).
 */
export const TRADE_TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
] as const;

/**
 * Supported candle timeframes for the market-regime action (mirrors the live tool enum).
 */
export const REGIME_TIMEFRAMES = ["1h", "4h", "1d"] as const;

/**
 * Supported perpetual-futures venues (mirrors the live tool enum).
 */
export const EXCHANGES = [
  "HL",
  "BINANCE",
  "BYBIT",
  "OKX",
  "BITGET",
  "ASTER",
  "EDGEX",
  "GATE",
  "MEXC",
  "KUCOIN",
  "PHEMEX",
  "BINGX",
  "HTX",
  "WEEX",
  "BITMART",
  "XT",
  "WHITEBIT",
] as const;
