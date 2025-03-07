# Pyth Action Provider

This directory contains the **PythActionProvider** implementation, which provides actions to interact with the **Pyth Network** for real-time price oracle data.

## Directory Structure

```
pyth/
├── pyth_action_provider.py    # Pyth action provider
├── __init__.py                # Main exports
└── README.md                  # This file

# From python/coinbase-agentkit/
tests/action_providers/pyth/
├── conftest.py                     # Test configuration
└── test_pyth_action_provider.py    # Test for Pyth action provider
```

## Actions

- `fetch_price_feed_id`: Fetch the price feed ID for a given asset
- `fetch_price`: Fetch the price for a given asset, by price feed ID
  - Can be chained with `fetch_price_feed_id` to fetch the price feed ID first

## Adding New Actions

To add new Pyth actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `pyth_action_provider.py`
3. Implement tests in `tests/action_providers/pyth/test_pyth_action_provider.py`

## Network Support

Pyth supports many blockchains. For more information, visit [Pyth Documentation](https://docs.pyth.network/home).
