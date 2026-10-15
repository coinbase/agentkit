---
"@coinbase/agentkit": minor
---

Added the agentsvc action provider with three pay-per-call safety checks over x402: `check_token_risk` (token grade A to F before a swap), `check_scam_message` (scam and phishing check for incoming messages, with link domain age and look-alike detection) and `check_prompt_injection` (untrusted text check). Payments are USDC only, on the wallet's network, and capped per call by `maxPaymentUsdc` (default 0.05, or `AGENTSVC_MAX_PAYMENT_USDC`).
