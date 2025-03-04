# WOW Action Provider

This directory contains the **WowActionProvider** implementation, which provides actions to interact with the **WOW Protocol** for creating and trading memecoins.

## Directory Structure

```
wow/
├── uniswap/
│   ├── constants.py          # Uniswap contract constants and ABI
│   └── utils.py              # Uniswap utility functions
├── wow_action_provider.py    # Wow action provider
├── schemas.py                # Wow action schemas
├── utils.py                  # Wow action utils
├── __init__.py               # Main exports
└── README.md                 # This file

# From python/coinbase-agentkit/
tests/action_providers/wow/
├── conftest.py                # Test configuration
└── test_create_memecoin.py    # Test create memecoin
```

## Actions

- `buy_token`: Buy a Zora Wow ERC20 memecoin with ETH.
- `create_token`: Create a Zora Wow ERC20 memecoin.
- `sell_token`: Sell a Zora Wow ERC20 memecoin.

## Adding New Actions

To add new WOW actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `wow_action_provider.py`
3. Implement tests in a new file in `tests/action_providers/wow/`

## Network Support

The WOW provider supports Base mainnet and Base sepolia.

## Notes

For more information on the **Wow protocol**, visit [Wow Documentation](https://wow.xyz/).
