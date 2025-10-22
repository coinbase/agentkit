# Superfluid Action Provider

This directory contains the **SuperfluidActionProvider** implementation, which provides actions to interact with **Superfluid Protocol** for streaming payments and token operations.

## Directory Structure

```
superfluid/
├── superfluid_action_provider.py    # Superfluid action provider
├── constants.py                     # Superfluid action constants
├── schemas.py                       # Superfluid action schemas
├── __init__.py                      # Main exports
└── README.md                        # This file

# From python/coinbase-agentkit/
tests/action_providers/superfluid/
└── test_superfluid_action_provider.py    # Test for Superfluid action provider
```

## Actions

- `create_flow`: Create a money flow to a specified token recipient
- `update_flow`: Update an existing money flow
- `delete_flow`: Delete an existing money flow

## Adding New Actions

To add new Superfluid actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `superfluid_action_provider.py`
3. Implement tests in `tests/action_providers/superfluid/test_superfluid_action_provider.py`

## Network Support

The Superfluid provider supports any EVM-compatible network.

## Notes

For more information on the **Superfluid Protocol**, visit [Superfluid Documentation](https://docs.superfluid.org/).
