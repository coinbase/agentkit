# NEXUS Action Provider

**NEXUS Intelligence** — live Kalshi + Polymarket prediction market data for AgentKit agents.

## Actions

| Action | Cost | Description |
|--------|------|-------------|
| `nexus_kalshi_consensus` | Free | Live Kalshi implied probability (Fed, BTC, CPI, GDP) |
| `nexus_arb_spread` | $0.02 USDC (x402) | Cross-venue Kalshi vs Polymarket spread |

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.nexus import nexus_action_provider

config = AgentKitConfig(...)
agentkit = AgentKit(config=config, action_providers=[nexus_action_provider()])

# Free
agentkit.invoke("nexus_kalshi_consensus", {"market": "Fed"})

# Paid — requires AgentKit x402 wallet on Base (eip155:8453)
agentkit.invoke("nexus_arb_spread", {"markets": "Fed,BTC"})
```

## Live endpoints

- Probe: https://nexus-agent-xa12.onrender.com/probe
- Free: https://nexus-agent-xa12.onrender.com/kalshi?market=Fed
- Paid: https://nexus-agent-xa12.onrender.com/arb/check?markets=Fed,BTC
- A2A Agent Card: https://nexus-agent-xa12.onrender.com/.well-known/agent.json

First prediction market data provider for AgentKit. Closes #1224.
