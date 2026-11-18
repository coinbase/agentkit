# x402search ActionProvider

Natural language search across **14,000+ indexed API services** for Coinbase AgentKit agents.

**Cost:** $0.01 USDC per query — paid automatically via x402 protocol on Base mainnet.

## Why

Coinbase Bazaar is `ls /apis`. x402search is `grep -r "token price"` across all of them.

When an agent needs a data source, it should search by capability — not iterate every Bazaar endpoint. This provider gives AgentKit agents that search natively, paid automatically with no human in the loop.

## Usage
```python
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.wallet_providers import CdpWalletProvider
from coinbase_agentkit.action_providers.x402search import x402search_action_provider

agentkit = AgentKit(AgentKitConfig(
    wallet_provider=CdpWalletProvider(cdp_config),
    action_providers=[x402search_action_provider()],
))
```

## Best queries

| Query | Results |
|-------|---------|
| `crypto` | 112 |
| `token price` | 88 |
| `crypto market data` | 10 |
| `btc price` | 8 |

## Links
- Live API: https://x402search.xyz
- MCP package: `x402search-mcp`
- x402 protocol: https://x402.org
