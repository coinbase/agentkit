# CDP (Coinbase Developer Platform) V2 Action Provider

This directory contains the **CdpV2ActionProvider** implementation, which provides actions to interact with the **Coinbase Developer Platform (CDP)** API and wallet services.

## Directory Structure

```
cdp/
├── cdpApiActionProvider.ts              # Provider for CDP API interactions
├── cdpApiActionProvider.test.ts         # Tests for CDP API provider
├── cdpEvmWalletActionProvider.ts        # Provider for CDP EVM Wallet operations
├── cdpSmartWalletActionProvider.ts      # Provider for CDP Smart Wallet operations
├── cdpEvmWalletActionProvider.test.ts   # Tests for CDP EVM Wallet provider
├── cdpSmartWalletActionProvider.test.ts # Tests for CDP Smart Wallet provider
├── schemas.ts                           # Action schemas for CDP operations
├── index.ts                             # Main exports
└── README.md                            # This file
```

## Actions

### CDP API Actions

- `request_faucet_funds`: Request testnet funds from CDP faucet

  - Available only on Base Sepolia, Ethereum Sepolia or Solana Devnet

### CDP EVM Wallet Actions

- `list_spend_permissions`: Lists spend permissions that have been granted to the current EVM wallet by a smart account.
- `use_spend_permission`: Uses a spend permission to spend tokens on behalf of a smart account that the current EVM wallet has permission to spend.
- `get_swap_price`: Fetches a price quote for swapping between two tokens using the CDP Swap API (does not execute swap).
- `swap`: Executes a token swap using the CDP Swap API with automatic token approvals.

### CDP Smart Wallet Actions

- `list_spend_permissions`: Lists spend permissions that have been granted to the current smart wallet by a smart account.
- `use_spend_permission`: Uses a spend permission to spend tokens on behalf of a smart account that the current smart wallet has permission to spend.
- `get_swap_price`: Fetches a price quote for swapping between two tokens using the CDP Swap API (does not execute swap).
- `swap`: Executes a token swap using the CDP Swap API with automatic token approvals.

## Adding New Actions

To add new CDP actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in the appropriate provider file:
   - CDP API actions in `cdpApiActionProvider.ts`
   - CDP EVM Wallet actions in `cdpEvmWalletActionProvider.ts`
   - CDP Smart Wallet actions in `cdpSmartWalletActionProvider.ts`
3. Add corresponding tests

## Network Support

The CDP providers support all networks available on the Coinbase Developer Platform, including:

- Base (Mainnet & Testnet)
- Ethereum (Mainnet & Testnet)
- Other EVM-compatible networks

## Notes

- Requires CDP API credentials (API Key ID and Secret). Visit the [CDP Portal](https://portal.cdp.coinbase.com/) to get your credentials.

For more information on the **Coinbase Developer Platform**, visit [CDP Documentation](https://docs.cdp.coinbase.com/).
