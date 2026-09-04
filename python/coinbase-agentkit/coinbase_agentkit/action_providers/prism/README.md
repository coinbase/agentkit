# Prism Action Provider

This directory contains the `PrismActionProvider` class, which provides actions for renting real NVIDIA GPUs through [Prism Network](https://prismnetwork.tech).

The provider carries its own funded wallet (`PRISM_AGENT_KEY`) and settles onchain in USDG, so it composes with any AgentKit wallet provider rather than spending the agent's primary wallet.

## Actions

- `wallet`: The Prism agent wallet address and its USDG and native balances.
- `list_gpus`: GPUs available to rent right now, with model, VRAM, and price per hour.
- `lease_and_run`: Rent a GPU, run a command, and return the output. Pays onchain in USDG up to `max_usdg`.
- `run`: Run another command on a GPU already leased in this session.
- `end_lease`: Release a leased GPU session.

## Environment

- `PRISM_AGENT_KEY` (required): the agent wallet private key, funded with USDG and native gas on Robinhood Chain.
- `PRISM_ESCROW` (optional): the lease-escrow contract address. Defaults to the canonical escrow.

## Setup

```python
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.prism import prism_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[prism_action_provider()],
    )
)
```

## Notes

- `lease_and_run` blocks while the machine provisions, usually one to four minutes. Give the agent a long tool-call timeout.
- Leasing spends real USDG onchain, capped by `max_usdg`.

For more information on the **Prism Network**, visit [prismnetwork.tech](https://prismnetwork.tech).
