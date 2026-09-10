---
"@coinbase/agentkit": patch
---

Add MainStreet action provider: `check_reputation` returns an onchain-verifiable SAFE/CAUTION/BLOCK reputation verdict + 0–100 score for a Base counterparty before payment, so an agent can refuse to pay BLOCK-rated or unscored addresses.
