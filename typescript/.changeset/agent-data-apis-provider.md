---
"@coinbase/agentkit": patch
---

Added the Agent Data APIs action provider with x402-paid pre-trade and pre-payment safety checks: `check_token_risk` (honeypot and buy/sell tax simulation, owner powers), `check_payment_counterparty` (sanctioned crypto addresses, x402 seller reputation) and `screen_sanctions` (OFAC, UN, EU, UK name screening).
