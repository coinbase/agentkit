# Onramp Action Provider

This directory contains the **OnrampActionProvider** implementation, which provides actions for cryptocurrency onramp operations - specifically helping users purchase cryptocurrency using fiat currency (regular money like USD).

### Environment Variables
```
CDP_PROJECT_ID
```

Creating the OnrampActionProvider requires a CDP project ID. You can create one at https://portal.cdp.coinbase.com/

## Directory Structure

```
onramp/
├── __init__.py                    # Package exports
├── constants.py                   # Version and URL constants
├── onramp_action_provider.py      # Main provider implementation
├── utils.py                       # Utility functions
├── schemas.py                     # Onramp action schemas
└── README.md                      # This file
```

## Actions

### get_onramp_buy_url

- **Purpose**: Generates a URL for purchasing cryptocurrency through Coinbase's onramp service
- **Output**: String containing the URL to the Coinbase-powered purchase interface
- **Example**:
  ```python
  result = await provider.get_onramp_buy_url(wallet_provider, {})
  ```

Use this action when:
- The wallet has insufficient funds for a transaction
- You need to guide the user to purchase more cryptocurrency
- The user asks how to buy more crypto

Supported assets:
- ETH (Ethereum)
- USDC (USD Coin)

## Network Support

The provider supports base, ethereum, polygon, optimism, and arbitrum mainnet networks.

## Implementation Details

### Key Components
- Supports URL parameter generation and encoding
- Includes network ID conversion for Coinbase Onramp compatibility

### Adding New Actions
1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `onramp_action_provider.py`
3. Add corresponding tests

## Notes

- Requires a valid Coinbase project ID for operation
- All operations are performed on EVM-compatible networks only
- Uses Coinbase's infrastructure for secure fiat-to-crypto transactions
