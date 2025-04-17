# Aave Action Provider

This directory contains the **AaveActionProvider** implementation, which provides actions to interact with the **Aave V3 protocol** on Base networks.

## Directory Structure

```
aave/
├── aave_action_provider.py   # Aave action provider
├── constants.py             # Aave action constants
├── schemas.py               # Aave action schemas
├── utils.py                 # Aave action utils
├── __init__.py              # Main exports
└── README.md                # This file

# From python/coinbase-agentkit/
tests/action_providers/aave/
├── conftest.py              # Test configuration
├── test_aave_provider.py    # Test for provider functionality
├── test_aave_supply.py      # Test for supply action
└── test_aave_schemas.py     # Test for schemas
```

## Actions

- `supply`: Supply assets to Aave V3 pool
- `withdraw`: Withdraw assets from Aave V3 pool
- `borrow`: Borrow assets from Aave V3 pool
- `repay`: Repay borrowed assets
- `get_portfolio`: Get user's supply and borrow positions
- `set_as_collateral`: Enable or disable an asset as collateral

## Network Support

The Aave provider currently supports:
- Base Mainnet (`base-mainnet`)

## Supported Assets

### Base Mainnet
- Supply/Collateral Assets: USDC, WETH, cbETH available on Aave V3 Base
- Borrow Assets: Most assets supported by Aave V3 on Base

## Notes

For more information on the Aave protocol, visit the [Aave Documentation](https://docs.aave.com/).