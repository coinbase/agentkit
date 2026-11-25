---
"@coinbase/agentkit": patch
---

Added the Agentic Finance Graph action provider: read-only actions that check an ERC-8004 agent or a payment destination on Base against observed, receipt-checked payments before the agent pays it (`check_agent`, `get_agent_statement`, `check_payee`, `get_agent_economy_overview`). No API key or wallet access is required.
