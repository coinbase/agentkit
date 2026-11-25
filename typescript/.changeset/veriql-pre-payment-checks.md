---
"@coinbase/agentkit": patch
---

Added a Veriql action provider with `check_payee` and `check_signature` (OFAC, scam-address and stablecoin-freeze checks before sending funds or signing, paid per call over x402 or with an API key) and a free `check_denylist` lookup.
