---
"@coinbase/agentkit": minor
---

Added an optional `beforePayment` hook to the x402 action provider config. It is registered on the x402 client with `onBeforePaymentCreation`, so a check can approve or block each payment before it is signed (for example a sanctions screen of `payTo` or a spend policy).
