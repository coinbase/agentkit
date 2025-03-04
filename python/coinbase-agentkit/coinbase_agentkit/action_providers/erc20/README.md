# ERC20 Action Provider

This directory contains the **ERC20ActionProvider** implementation, which provides actions to interact with **ERC20 tokens** on EVM-compatible networks.

## Directory Structure

```
erc20/
├── erc20_action_provider.py      # Main provider with ERC20 token functionality
├── constants.py                  # Constants including ERC20 ABI
├── schemas.py                    # Pydantic schemas for action inputs
├── validators.py                 # Input validation utilities
├── __init__.py                   # Package exports
└── README.md                     # This file

# From python/coinbase-agentkit/
tests/action_providers/erc20/
├── conftest.py                    # Test configuration
├── test_erc20_action_provider.py  # Test for ERC20 action provider
```

## Actions

### ERC20 Token Actions

- `get_balance`: Get the balance of an ERC20 token

  - Returns the **balance** of the token in the wallet
  - Formats the balance with the correct number of decimals
  - Takes a contract address as input

- `transfer`: Transfer ERC20 tokens to another address
  - Takes amount, contract address, and destination as inputs
  - Constructs and sends the transfer transaction
  - Returns the **transaction hash** upon success
  - Handles decimal formatting automatically

## Adding New Actions

To add new ERC20 actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `erc20_action_provider.py`
3. Implement tests in `tests/action_providers/erc20/test_erc20_action_provider.py`

## Network Support

The ERC20 provider supports all EVM-compatible networks.

## Notes

For more information on the **ERC20 token standard**, visit [ERC20 Token Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/).
