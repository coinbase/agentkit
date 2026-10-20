---
"@coinbase/agentkit": patch
---

Bound x402 prepared-retry and auto-pay to a frozen payment requirement so a retry cannot silently switch quotes. Required official settlement proof with protocol-aware payer and transaction checks before treating a payment as settled. Rejected over-limit auto-pay before signing so `maxPaymentUsdc` is enforced on the frozen selected requirement.
