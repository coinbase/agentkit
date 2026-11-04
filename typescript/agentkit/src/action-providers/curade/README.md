# Curade Action Provider

This provider integrates [Curade](https://curade.xyz) — an x402-paid market-data API — into AgentKit, so AI agents can pull derived prediction-market and perp-funding analytics and pay per call with USDC.

## Overview

Curade serves derived market data with venue attribution, collected from public prediction-market and perp venues — **Polymarket, Kalshi, Limitless, and Hyperliquid**. Every paid endpoint uses the [x402 payment protocol](https://www.x402.org/): an unpaid call returns HTTP 402 with an x402 payment challenge, and the tools surface that challenge verbatim. This provider deliberately does **not** sign payments — settle the challenge with an x402-enabled wallet client (e.g. AgentKit's built-in `x402ActionProvider`, or an `x402-fetch` wrapper backed by an EVM wallet) and retry the identical request with the signed payment in the header the challenge's `error` field names (Curade's v2 endpoint expects `Payment-Signature`).

## Setup

No configuration required — the provider calls the public API at `https://api.curade.xyz`.

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { curadeActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [curadeActionProvider()],
});
```

To pay automatically, pair it with AgentKit's `x402ActionProvider` and register `https://api.curade.xyz` in its `registeredServices` whitelist.

## Actions

| Action | Endpoint | Price | Description |
|--------|----------|-------|-------------|
| `curade_polymarket_odds` | `GET /v1/polymarket/odds` | $0.005 / call | Latest Polymarket odds snapshot, volume-ranked, filtered by optional `q` (source: Polymarket) |
| `curade_polymarket_disagreement` | `GET /v1/polymarket/disagreement` | $0.02 / call | Cross-venue disagreement: latest Polymarket snapshot vs live Kalshi markets |
| `curade_polymarket_package` | `GET /v1/polymarket/package` | $2.00 one-time | Full attested data package for one Polymarket market plus a signed license token — pay once, keep the data |
| `curade_hyperliquid_funding` | `GET /v1/funding/current` | $0.001 / call | Latest Hyperliquid per-coin funding snapshot: signed hourly funding rate + derived APR, ranked by open interest |

## Attribution

All data is derived and attributed to its source venues: prediction-market coverage spans Polymarket, Kalshi, and Limitless; perp-funding coverage is Hyperliquid. Each endpoint names its sources, and responses are derived products of those venues' public data.

## Network Support

This provider supports EVM networks — x402 settlement is USDC on an EVM chain, with the exact terms (network, asset, payTo, maxAmountRequired) in each 402 challenge's `accepts[]`.

## Dependencies

None beyond AgentKit itself — the tools use the platform `fetch` and surface the raw x402 challenge on HTTP 402.
