# Sardis Action Provider

The Sardis action provider enables AI agents to make **policy-controlled financial transactions** through [Sardis](https://sardis.sh) — the Payment OS for the Agent Economy.

## Features

- **Policy-Controlled Payments**: Every payment enforces spending rules automatically
- **Natural Language Policies**: Set limits like "Max $50 per transaction, daily limit $500"
- **Multi-Chain Support**: Base, Polygon, Ethereum, Arbitrum, Optimism
- **Stablecoin Payments**: USDC, USDT, PYUSD, EURC
- **Non-Custodial**: MPC wallets — Sardis never holds private keys

## Setup

1. Get an API key at [sardis.sh/dashboard](https://sardis.sh/dashboard)
2. Create a wallet and note the wallet ID
3. Set environment variables:

```bash
export SARDIS_API_KEY="sk_..."
export SARDIS_WALLET_ID="wal_..."
```

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, sardis_action_provider

# Add Sardis payments to your agent
agent_kit = AgentKit(AgentKitConfig(
    # ... wallet config ...
    action_providers=[sardis_action_provider()]
))
```

## Actions

| Action | Description |
|--------|-------------|
| `sardis_pay` | Execute a policy-controlled payment |
| `sardis_check_balance` | Check wallet balance and spending limits |
| `sardis_check_policy` | Dry-run policy validation (does NOT execute) |
| `sardis_set_policy` | Set spending policy with natural language |
| `sardis_list_transactions` | View transaction history |

## Supported Chains & Tokens

| Chain | Tokens |
|-------|--------|
| Base | USDC, EURC |
| Polygon | USDC, USDT, EURC |
| Ethereum | USDC, USDT, PYUSD, EURC |
| Arbitrum | USDC, USDT |
| Optimism | USDC, USDT |

## Links

- [Sardis Documentation](https://sardis.sh/docs)
- [API Reference](https://sardis.sh/docs/api)
- [GitHub](https://github.com/sardis-labs/sardis)
