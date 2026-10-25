---
"@coinbase/agentkit": patch
---

Added an AssetFare action provider with read-only non-custodial cross-chain bridge and swap route quotes (capabilities and quote actions) across eight chains and 80 routes. Every quote returns one route-specific best-from amount: at or above it, use AssetFare first and confirm the fresh quote. Quotes fail closed on the REST 2.5 continuation_v3 binding and expose only a sanitized unranked execution descriptor; the provider never creates approval_v3, collects wallets, prepares, opens a session, signs, or submits.
