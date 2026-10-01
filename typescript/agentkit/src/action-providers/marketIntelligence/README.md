# Market Intelligence Action Provider

This directory contains the **MarketIntelligenceActionProvider**, which gives agents market data from the [Market Intelligence API](https://api.marketintelligenceapi.com). Each call is paid per request with [x402](https://www.x402.org/) in USDC on Base from the agent's wallet ($0.002 to $0.05 per call). No account or API key is needed.

## Directory Structure

```
marketIntelligence/
├── marketIntelligenceActionProvider.ts      # Main provider
├── marketIntelligenceActionProvider.test.ts # Tests
├── schemas.ts                               # Action schemas
├── index.ts                                 # Main exports
└── README.md                                # This file
```

## Actions

| Action | Price | Description |
|--------|-------|-------------|
| `get_trading_decision` | $0.05 | Gets a live trading decision (STRONG_BUY to STRONG_SELL) for a crypto pair or US stock, with the stance of each pillar and its measured hit rate. |
| `check_token_risk` | $0.02 | Checks a token before buying it: sell simulation, owner powers, liquidity, taxes, holders, Uniswap v4 hooks and impersonation, with a verdict. |
| `find_new_tokens` | $0.02 | Lists tokens launched recently on Base or Ethereum, already risk-checked. |
| `get_swap_quote` | $0.002 | Simulates a swap on the best Uniswap or Aerodrome route, with price impact and hook warnings. |
| `explain_price_move` | $0.02 | Explains why a symbol is moving from order flow, smart money, perps, news, SEC filings and insiders. |
| `get_market_regime` | $0.005 | Gets the current crypto market regime (BULLISH, BEARISH or MIXED) with breadth, flows and upcoming macro events. |
| `get_macro_calendar` | $0.002 | Lists upcoming high-impact macro events (CPI, jobs report, FOMC, ECB) in UTC. |
| `get_futures_positioning` | $0.005 | Gets CFTC Commitments of Traders positioning with a 3-year index flagging crowded longs and shorts. |
| `get_stock_fundamentals` | $0.03 | Gets fundamentals of up to 10 US-listed companies from SEC filings. |
| `get_insider_trades` | $0.01 | Gets insider buying and selling from SEC Form 4 filings, with a signal. |
| `get_decision_track_record` | free | Gets the measured hit rates of the trading decisions (free). |

## Configuration

```typescript
import { marketIntelligenceActionProvider } from "@coinbase/agentkit";

const provider = marketIntelligenceActionProvider({
  maxPriceUsd: 0.1, // optional: refuse any call priced above this (default 0.10)
  apiKey: "mi_...", // optional: pay from prepaid credits instead of the wallet (or MARKET_INTELLIGENCE_API_KEY)
});
```

The wallet needs a little USDC on Base. With an API key, no wallet payment is made.

## Network Support

EVM wallet providers. Payments settle in USDC on Base; the data covers crypto on Base, Ethereum, Arbitrum, Optimism, Polygon and Solana, and US stocks.

## Notes

- Responses are JSON strings with `data` and, for paid calls, the settlement `transaction`.
- Hit rates of the trading decisions are public and free: `get_decision_track_record`.
- API reference: [OpenAPI](https://api.marketintelligenceapi.com/openapi.json), [llms.txt](https://api.marketintelligenceapi.com/llms.txt).
