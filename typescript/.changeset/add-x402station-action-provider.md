---
"@coinbase/agentkit": patch
---

Added a new `x402station` action provider — a pre-flight oracle for the x402 agentic-commerce network. Six tools (preflight, forensics, catalog_decoys, watch_subscribe, watch_status, watch_unsubscribe) wrapping the public oracle at https://x402station.io. Four are paid via x402 ($0.001–$0.01 USDC, auto-signed via the agent's `EvmWalletProvider`); two are free + secret-gated for managing an existing webhook subscription. Networks: Base mainnet and Base Sepolia.
