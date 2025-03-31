# Onramp Action Provider

This directory contains the **OnrampActionProvider** implementation, which provides actions for cryptocurrency onramp operations - specifically helping users purchase cryptocurrency using fiat currency (regular money like USD).

## Directory Structure

```
onramp/
├── utils/                          # Utility functions and constants
│   ├── constants.py               # Version and URL constants
│   ├── network_conversion.py      # Network ID conversion utilities
│   └── __init__.py               # Utils exports
├── onramp_action_provider.py      # Main provider implementation
├── schemas.py                     # Onramp action schemas
├── __init__.py                    # Package exports
└── README.md                      # This file
```

## Actions

### get_onramp_buy_url

- **Purpose**: Generates a URL for purchasing cryptocurrency through Coinbase's onramp service
- **Input**:
  - `asset`: The cryptocurrency to purchase (Enum: "ETH" or "USDC", defaults to "ETH")
- **Output**: String containing the URL to the Coinbase-powered purchase interface
- **Example**:
  ```python
  result = await provider.get_onramp_buy_url(wallet_provider, {
      "asset": "ETH"
  })
  ```

Use this action when:
- The wallet has insufficient funds for a transaction
- You need to guide the user to purchase more cryptocurrency
- The user asks how to buy more crypto

Supported assets:
- ETH (Ethereum)
- USDC (USD Coin)

## Network Support

The provider supports all EVM-compatible networks, with specific support for:
- Base Mainnet (`base-mainnet`)
- Base Sepolia (`base-sepolia`)

## Implementation Details

### Key Components
- Uses Pydantic for schema validation
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
