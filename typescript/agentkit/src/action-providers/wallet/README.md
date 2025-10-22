# Wallet Action Provider

This directory contains the **WalletActionProvider** implementation, which provides actions for basic wallet operations and information retrieval across multiple blockchain networks.

## Directory Structure

```
wallet/
├── walletActionProvider.ts         # Main provider with wallet functionality
├── walletActionProvider.test.ts    # Test file for wallet provider
├── schemas.ts                      # Wallet action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `get_wallet_details`: Get wallet information

  - Returns wallet address
  - Includes native token balance
  - Provides network details

- `native_transfer`: Transfer native tokens (ETH, SOL)

## Adding New Actions

To add new wallet actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `walletActionProvider.ts`
3. Add tests in `walletActionProvider.test.ts`

## Network Support

The wallet provider is blockchain-agnostic.

## Notes

For more information on wallet operations, refer to the specific wallet provider documentation for your chosen network.
