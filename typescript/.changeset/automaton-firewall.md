---
"@coinbase/agentkit": minor
---

Added an Automaton Firewall action provider with a `simulate_and_guard_transaction` action that runs a paid (x402, 0.02 USDC on Base) pre-flight check before an agent sends a transaction. The provider checks the 402 challenge before signing (exact scheme, Base, USDC, treasury recipient, configurable `maxAmountUnits` cap) and returns explicit `payment_refused` or `unavailable` states instead of a verdict when it cannot pay or reach the service.
