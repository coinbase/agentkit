---
"@coinbase/agentkit": patch
---

Added an Apex action provider with tx_check (unsigned Base or Solana transaction, SAFE or RISKY) and delivery_score (0 to 100 for an x402 URL). Both call the public HTTPS routes and return unpaid x402 terms for the caller's own wallet. Nothing is signed here.
