---
"@coinbase/agentkit": minor
---

Added AgentRadar action provider with `verify_agent` and `get_trust_badge` actions to check an AI agent or wallet's on-chain trust score (a composite of ERC-8004 reputation, a scam-wallet database, and static analysis) before interacting with or paying it. The provider is network-agnostic, read-only, and requires no API key.
