# Wallet Action Provider

This directory contains the **WalletActionProvider** implementation, which provides actions to interact with the **Wallet API** for wallet operations.

## Directory Structure

```
wallet/
├── wallet_action_provider.py    # Wallet action provider
├── schemas.py                   # Wallet action schemas
├── validators.py                # Wallet action validators
├── __init__.py                  # Main exports
└── README.md                    # This file

# From python/coinbase-agentkit/
tests/action_providers/wallet/
├── conftest.py                # Test configuration
├── test_get_balance.py        # Test get balance
├── test_get_details.py        # Test get details
└── test_native_transfer.py    # Test native transfer
```

## Actions

- `get_wallet_details`: Get wallet information

  - Returns wallet address
  - Includes native token balance
  - Provides network details

- `native_transfer`: Transfer native tokens (ETH, SOL)

## Adding New Actions

To add new wallet actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `wallet_action_provider.py`
3. Implement tests in a new file in `tests/action_providers/wallet/`

## Network Support

The wallet provider is blockchain-agnostic.

## Notes

For more information on wallet operations, refer to the specific wallet provider documentation for your chosen network.
