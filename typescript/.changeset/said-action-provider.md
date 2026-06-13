---
"@coinbase/agentkit": minor
---

Added SAID Protocol action provider for Solana agent identity and reputation: look up any wallet's reputation before paying it (get_agent_reputation), discover reputable agents with their A2A/MCP/x402 endpoints (find_agents), register a self-paid on-chain SAID identity (register_said_identity), and send/receive agent-to-agent messages through the SAID relay with sender reputation attached (send_agent_message, check_agent_messages).
