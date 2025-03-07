# WETH Action Provider

This directory contains the **WethActionProvider** implementation, which provides actions to interact with **Wrapped Ether (WETH)** contracts.

## Directory Structure

```
weth/
├── weth_action_provider.py    # Weth action provider
├── schemas.py                 # Weth action schemas
├── __init__.py                # Main exports
└── README.md                  # This file

# From python/coinbase-agentkit/
tests/action_providers/weth/
├── conftest.py         # Test configuration
└── test_wrap_eth.py    # Test wrap eth
```

## Actions

- `wrap_eth`: Convert ETH to WETH

## Adding New Actions

To add new WETH actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `weth_action_provider.py`
3. Implement tests in a new file in `tests/action_providers/weth/`

## Network Support

The WETH provider supports Base mainnet and Base sepolia.

## Notes

For more information on **Wrapped Ether**, visit [Wrapped Ether Documentation](https://ethereum.org/en/wrapped-eth/).
