---
"@coinbase/agentkit": patch
---

Added Curade action provider for the x402-paid market-data API at https://api.curade.xyz. Exposes four tools — `curade_polymarket_odds`, `curade_polymarket_disagreement`, `curade_polymarket_package`, and `curade_hyperliquid_funding` — covering Polymarket odds snapshots, Polymarket-vs-Kalshi disagreement, one-time attested Polymarket data packages, and Hyperliquid funding snapshots. Unpaid calls return HTTP 402 with the x402 challenge base64-encoded in the `Payment-Required` response header (per x402 v2; the body is empty) — the tools decode and surface it verbatim. Payment signing is delegated to x402-enabled wallet clients.
