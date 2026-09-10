# AlgoVault Action Provider

This directory contains the AlgoVault action provider implementation, which gives an agent
access to AlgoVault's crypto trading signals: composite BUY/SELL/HOLD trade calls, market-regime
classification, and cross-venue funding-rate arbitrage scanning.

The provider is **walletless** and **read-only**. It speaks MCP directly to the AlgoVault MCP
server (`api.algovault.com/mcp`) over Streamable HTTP — the same surface every AlgoVault client
uses. All verdicts are backed by AlgoVault's verified, on-chain (Base Merkle-anchored) track
record: [algovault.com/track-record](https://algovault.com/track-record).

## Getting Started

The free tier is **keyless** — no API key is required, so the provider works out of the box:

```typescript
import { algoVaultActionProvider } from "@coinbase/agentkit";

const provider = algoVaultActionProvider();
```

An optional API key unlocks paid-tier limits. Provide it via the constructor or the
`ALGOVAULT_API_KEY` environment variable:

```typescript
const provider = algoVaultActionProvider({
  apiKey: "your_algovault_api_key",
});
```

### Environment Variables

```
ALGOVAULT_API_KEY   # optional — only needed for paid tiers
```

## Directory Structure

```
algovault/
├── algovaultActionProvider.test.ts  # Tests for the provider
├── algovaultActionProvider.ts       # Main provider with the AlgoVault actions
├── constants.ts                     # Endpoint, client info, and enum constants
├── index.ts                         # Main exports
├── README.md                        # Documentation
├── schemas.ts                       # Action input schemas
├── types.ts                         # Type definitions
└── utils.ts                         # MCP client and error-formatting helpers
```

## Actions

- `get_trade_call`: Composite BUY/SELL/HOLD trade call for a crypto perpetual-futures market (or a
  supported TradFi symbol). Inputs: `coin`, optional `timeframe` (default `15m`), optional
  `exchange` (default `BINANCE`), optional `includeReasoning`. Returns verdict, confidence, market
  regime, funding rate, and reasoning. **Free.**
- `get_trade_signal`: Alias of `get_trade_call` (same behavior, kept for backward compatibility).
- `get_market_regime`: Classifies the market regime — `TRENDING_UP`, `TRENDING_DOWN`, `RANGING`, or
  `VOLATILE`. Inputs: `coin`, optional `timeframe` (`1h`/`4h`/`1d`, default `4h`), optional
  `exchange` (default `HL`). Returns the regime label, confidence, and a strategy hint.
- `scan_funding_arb`: Scans for cross-venue funding-rate arbitrage opportunities across Binance,
  Bybit, OKX, Bitget, and Hyperliquid. Inputs: optional `minSpreadBps` (default `5`), optional
  `limit` (default `10`). Returns ranked opportunities with the funding spread per venue pair.

## Rate Limiting

The free tier allows **100 calls/month** and requires no API key. `HOLD` verdicts never cost
quota. Paid tiers (set via `ALGOVAULT_API_KEY`) raise the monthly limit — see
[algovault.com/pricing](https://algovault.com/pricing).

## Examples

### Composite trade call

*What's the trade call for BTC right now?*

<details>
<summary>Tool Output</summary>

```json
{
  "call": "HOLD",
  "confidence": 15,
  "price": 64202,
  "indicators": {
    "funding_rate": -0.00001362,
    "funding_state": "ELEVATED",
    "oi_change_pct": -3.7,
    "volume_24h": 30454436125.28,
    "trend_persistence": "HIGH",
    "underlying_session": "ALWAYS_OPEN"
  },
  "regime": "TRENDING_UP",
  "reasoning": "Trending regime, upward bias. Funding pressure elevated; one-sided crowd forming. Trend persistence elevated; momentum structure. No actionable setup at this snapshot.",
  "coin": "BTC",
  "timeframe": "15m",
  "_algovault": {
    "version": "1.20.0",
    "tool": "get_trade_call",
    "exchange": "BINANCE"
  }
}
```

</details>

This output was produced by a live, keyless call against the AlgoVault free tier.
