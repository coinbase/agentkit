---
"@coinbase/agentkit": patch
---

Added live pre-sign spend policy enforcement (`spendPolicy` + rolling `SpendLedger`) and offline Ed25519 delivery receipt verification (`Payment-Receipt` / `paxiom.receipt.v0` + `AuthCaptureEscrow` `CAPTURE`/`VOID` arbitration) to `X402ActionProvider`, closing live `maxPaymentUsdc` and `payTo` bait-and-switch gaps across `make_http_request_with_x402` and `retry_http_request_with_x402`.
