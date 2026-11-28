---
"@coinbase/agentkit": patch
---

`make_http_request_with_x402` now returns the same structured "Payment exceeds limit" error as `retry_http_request_with_x402` when x402 spend controls reject a payment above `maxPaymentUsdc`, instead of a generic request error.