# HelmSwap Action Provider

This directory contains the **HelmswapActionProvider**, which quotes and executes token swaps on EVM networks through [HelmSwap](https://helmswap.com)'s public API (https://helmswap.com/openapi.json). No API key is required.

HelmSwap returns a quote and an **unsigned** transaction. The provider signs and sends it with the agent's own `EvmWalletProvider`, so it never handles private keys, and the API never signs or broadcasts. The fee is disclosed in every quote.

## Directory Structure

```
helmswap/
├── helmswap_action_provider.py    # Main provider
├── schemas.py                     # Action input schemas
├── __init__.py
└── README.md                      # This file

# From python/coinbase-agentkit/
tests/action_providers/helmswap/
└── test_helmswap_action_provider.py
```

## Actions

- `get_swap_quote_from_helmswap`: expected output, minimum output after slippage, price impact and the disclosed fee, converted from whole units using on-chain decimals. Nothing is executed.
- `execute_swap_on_helmswap`: quote, build with the wallet as recipient, send any exact-amount ERC-20 approval (waiting for its receipt), then send the swap and wait for its receipt. It does not build when the quote reports the price impact as too high.

## Supported networks

EVM chain ids 1, 56, 999, 4663, 5042, 8453, 57073 and 99901 (`supports_network` checks this list).

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, helmswap_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[helmswap_action_provider()],
    )
)
```
