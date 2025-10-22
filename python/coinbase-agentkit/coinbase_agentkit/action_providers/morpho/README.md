# Morpho Action Provider

This directory contains the **MorphoActionProvider** implementation, which provides actions to interact with **Morpho Protocol** for optimized lending and borrowing operations.

## Directory Structure

```
morpho/
├── morpho_action_provider.py    # Morpho action provider
├── constants.py                 # Morpho action constants
├── schemas.py                   # Morpho action schemas
├── utils.py                     # Morpho action utils
├── __init__.py                  # Main exports
└── README.md                    # This file

# From python/coinbase-agentkit/
tests/action_providers/morpho/
├── conftest.py                       # Test configuration
└── test_morpho_action_provider.py    # Test for Morpho action provider
```

## Actions

- `deposit`: Deposit assets into a Morpho Vault
- `withdraw`: Withdraw assets from a Morpho Vault

## Adding New Actions

To add new Morpho actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `morpho_action_provider.py`
3. Implement tests in `tests/action_providers/morpho/test_morpho_action_provider.py`

## Network Support

The Morpho provider supports Base mainnet and Base sepolia.

## Notes

For more information on the **Morpho Protocol**, visit [Morpho Documentation](https://docs.morpho.org/).
