# SAID Action Provider

This directory contains the **SaidActionProvider** implementation, which provides actions to interact with the [SAID Protocol](https://saidprotocol.com) — an on-chain identity and reputation layer for AI agents on Solana.

SAID gives every agent wallet a verifiable on-chain identity and a reputation score derived from observable behavior: x402 payments received, anchored work receipts, peer feedback and attestations. Reputation is a byproduct of the agent actually doing work and getting paid — not self-reported claims.

## Directory Structure

```
said/
├── saidActionProvider.ts         # Main provider with SAID functionality
├── constants.ts                  # Program ID, API URL, fee constants
├── schemas.ts                    # Action schemas
├── utils.ts                      # Instruction builders and PDA derivation
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `get_agent_reputation`: Look up the SAID reputation of **any** Solana wallet — tier, composite score (0–1), registration and verification status. Designed as a pre-payment trust check: call it before paying an unknown counterparty (e.g. via x402). A wallet with no track record returns an explicit "unknown counterparty" result, never a fake neutral score.
- `find_agents`: Discover SAID-registered agents ranked by reputation, filtered by free-text query or skill. Results include each agent's service endpoints (A2A, MCP, x402 wallet) when published — so agents can find, vet and then pay or message each other.
- `register_said_identity`: Register **this** wallet as a SAID agent and verify it on-chain, in one self-paid transaction (`register_agent` + `get_verified`). The wallet pays its own costs: ~0.0035 SOL account rent plus a one-time 0.01 SOL verification fee. Requires a metadata URI (an [A2A agent card](https://google.github.io/A2A/) URL works well).
- `send_agent_message`: Send an agent-to-agent (A2A) message to another SAID agent through the SAID relay. This wallet must be registered (the relay records the sender's verification and reputation). The recipient does not need to run its own server — every SAID agent has a relay mailbox — so this works for any registered agent. Returns a task id.
- `check_agent_messages`: Read incoming A2A messages addressed to this wallet, each annotated with the sender's wallet, name, verification status and reputation score, so the agent can decide whether to act based on who is asking.

## Network Support

Solana mainnet (`solana-mainnet`) only. Registration is a mainnet transaction; reputation data covers mainnet agents.

## Notes

- The reputation lookups are read-only HTTP calls to the SAID API (`https://api.saidprotocol.com`, configurable via `apiUrl`). No keys or authentication required.
- Registration is fully self-custodial: the agent's own wallet signs and pays; no third party signs anything.
- SAID is complementary to human-verification systems (e.g. proof-of-personhood): it scores the **agent wallet's own track record**, not the human behind it. It is also complementary to the ERC-8004 provider: SAID covers the Solana side and derives scores from payment/delivery behavior.

For more information, see the [SAID Protocol documentation](https://saidprotocol.com).
