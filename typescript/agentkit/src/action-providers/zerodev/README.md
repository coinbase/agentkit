# ZeroDev Action Provider

This directory contains the **ZeroDevWalletActionProvider** implementation, which provides actions to interact with the **ZeroDev** wallet services and chain abstraction features.

## Directory Structure

```
zerodev/
├── zeroDevWalletActionProvider.ts     # Provider for ZeroDev Wallet operations
├── zeroDevWalletActionProvider.test.ts # Tests for ZeroDev Wallet provider
├── schemas.ts                         # Action schemas for ZeroDev operations
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

### ZeroDev Wallet Actions

- `get_cab`: Retrieves chain abstracted balances (CAB) for specified tokens across multiple networks

  - Input parameters:
    - `tokenTickers`: Array of token symbols (e.g., ["ETH", "USDC"])
    - `networks` (optional): Array of network IDs to check balances on
    - `networkType` (optional): Filter networks by type ("mainnet" or "testnet")
  - Returns aggregated balances across all specified networks for each token ticker

## Adding New Actions

To add new ZeroDev actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `zeroDevWalletActionProvider.ts`
3. Add corresponding tests in `zeroDevWalletActionProvider.test.ts`

## Network Support

The ZeroDev provider supports all EVM-compatible networks, including:

- Ethereum (Mainnet)
- Base (Mainnet)
- Optimism (Mainnet)
- Arbitrum (Mainnet)
- Polygon (Mainnet)
- Bsc (Mainnet)
- Avalanche (Mainnet)

## Notes

- The ZeroDev provider requires proper configuration of the ZeroDevWalletProvider
- Chain abstraction features work across all supported EVM networks
- The `get_cab` action provides a unified view of token balances across multiple chains

For more information on **ZeroDev**, visit the [ZeroDev Documentation](https://docs.zerodev.app/).
