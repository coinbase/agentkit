---
"@coinbase/agentkit": patch
---

Added an optional `prePaymentCheck` hook to the x402 action provider that runs right before a payment is signed and can block it. Unset by default; behavior is unchanged when it is not configured.
