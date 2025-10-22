# Vaultsfyi Action Provider

This directory contains the **VaultsfyiActionProvider** implementation, which provides actions for vaultsfyi operations.

## Overview

The VaultsfyiActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable users to interact with onchain yield opportunities.

## Directory Structure

```
vaultsfyi/
├── vaultsfyiActionProvider.ts       # Main provider implementation
└── vaultsfyiActionProvider.test.ts  # Provider test suite
├── schemas.ts                      # Action schemas and types
├── constants.ts                    # Provider constants
├── utils.ts                        # Provider utility functions
├── /api
    ├── actions.ts                  # vaultsfyi transactional API actions
    ├── types.ts                    # vaultsfyi API types
    ├── vaults.ts                   # vaults list getter
    ├── historicalData.ts           # vaults historical data getter
├── index.ts                        # Package exports
└── README.md                       # Documentation (this file)
```

## Actions
- `vaults`: Get the list of available vaults on vaultsfyi.
- `vault_details`: Get details of a specific vault.
- `historical_data`: Get historical data for a specific vault.
- `deposit`: Deposit assets into a vault.
- `redeem`: Redeem assets from a vault.
- `claim`: Claim rewards from a vault.
- `user-wallet-balances`: Get the user's native token and compatible ERC20 token balances.
- `positions`: Get the user's positions in vaults.

## Network Support
This provider supports selected evm networks.

### Wallet Provider Integration
This provider is specifically designed to work with EvmWalletProvider. Key integration points:
- Network compatibility checks
- Transaction signing and execution
- Balance and account management

## Adding New Actions

To add new actions:

1. Define the schema in `schemas.ts`:
2. Implement the action in `vaultsfyiActionProvider.ts`:
3. Add tests in `vaultsfyiActionProvider.test.ts`:

## Notes

[Vaults.fyi API docs](https://docs.vaults.fyi/api/vaults.fyi-api-overview)
