# Degenscan Intel Action Provider

Cross-asset market-event intelligence for agents: SEC filings, Fed/central-bank releases, regulator actions, earthquakes and storms, Nasdaq halts, DeFi hacks, Polymarket odds and Hyperliquid perp microstructure, normalized into one event schema and scored into per-asset impacts. Service: https://intel.degenscan.io (operator: Marbella Collins LLC, MIT). Information and analytics only — not investment advice.

## Actions

- `get_market_pulse` — last-hour event counts by class, high-severity count, venues open ($0.001)
- `get_market_events` — events since a window with per-asset impacts (direction, confidence, exposure path) ($0.005)
- `get_asset_brief` — one-call pre-trade brief for one asset ($0.10)
- `get_perp_derivs` — Hyperliquid funding, predicted funding by venue, OI, premium, flags ($0.003)
- `get_deribit_perps` — Deribit perps (venue for Coinbase Advanced international perps): funding, premium, OI, volume, gap vs Hyperliquid ($0.002)

## Setup

No key needed for the free trial (100 calls/day/IP). Set `DEGENSCAN_INTEL_API_KEY` for a prepaid key (bought with USDC: `POST https://intel.degenscan.io/v1/keys/x402/pack_1k`, $5 = 1,000 calls) or a Stripe plan. For per-call USDC payments via x402, pass an x402-wrapped fetch:

```ts
import { degenscanIntelActionProvider } from "@coinbase/agentkit";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const provider = degenscanIntelActionProvider({
  fetchFn: wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] }),
});
```

## Network support

Read-only HTTP; works on all networks.

## Notes

- Docs for LLMs: https://intel.degenscan.io/llms.txt · OpenAPI: https://intel.degenscan.io/openapi.json
- Public metrics (paying wallets and tx hashes; operator wallets excluded): https://intel.degenscan.io/v1/metrics
