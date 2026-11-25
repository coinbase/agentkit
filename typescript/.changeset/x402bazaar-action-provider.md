---
"@coinbase/agentkit": minor
---

Added the x402 Bazaar action provider with a `token_verdict_check` action that returns a pre-trade SAFE / CAUTION / AVOID / UNKNOWN safety verdict for any Base (eip155:8453) ERC-20 token, covering honeypot behavior, sell-tax, owner powers, exit-liquidity and freeze/seize controls. Uses a free daily tier by default, with an optional x402 paid path ($0.03 USDC/call) when payment is enabled with an EVM wallet.
