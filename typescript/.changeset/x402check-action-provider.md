---
"@coinbase/agentkit": minor
---

Added `x402checkActionProvider` with `preflight_check` and `verify_payto` actions, plus `createX402checkBeforePayment` for the x402 `beforePayment` hook (#1402 / #1454). Agents can trust-check a seller URL (ok|caution|avoid + history) before signing USDC.
