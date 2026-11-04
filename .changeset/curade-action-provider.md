---
"@coinbase/agentkit": minor
---

Add Curade action provider for the x402-paid market-data API at https://api.curade.xyz. Exposes four tools — `curade_polymarket_odds`, `curade_polymarket_disagreement`, `curade_polymarket_package`, and `curade_hyperliquid_funding` — covering Polymarket odds snapshots, Polymarket-vs-Kalshi disagreement, one-time attested Polymarket data packages, and Hyperliquid funding snapshots. Unpaid calls surface the HTTP 402 x402 payment challenge verbatim; payment signing is delegated to x402-enabled wallet clients.
