---
"@coinbase/agentkit": patch
---

X402 payments now enforce the configured spend cap, match retry payments to the selected network, asset, amount, and recipient, and reject URLs outside registered origins and path scopes. Paid requests do not follow redirects. Bumped `@x402/evm`, `@x402/fetch`, and `@x402/svm` to `~2.27.0`.
