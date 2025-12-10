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
├── sdk.ts                          # vaultsfyi SDK client
├── index.ts                        # Package exports
└── README.md                       # Documentation (this file)
```

## Actions
- `vaults`: Get the list of available vaults on vaultsfyi.
- `vault_details`: Get details of a specific vault.
- `vault_historical_data`: Get historical data for a specific vault.
- `transaction_context`: Get the transaction context for a vault.
- `execute_step`: Execute a step in a vault.
- `user_idle_assets`: Get the user's idle assets.
- `positions`: Get the user's positions.
- `rewards_context`: Get the rewards context.
- `claim_rewards`: Claim rewards.
- `benchmark_apy`: Get the benchmark APY.
- `historical_benchmark_apy`: Get the historical benchmark APY.
- `total_vault_returns`: Get the total returns for a vault.
- `user_events`: Get the user's events for a vault.

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
