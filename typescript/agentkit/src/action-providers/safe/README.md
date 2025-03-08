# Safe Action Provider

This directory contains the **SafeActionProvider** implementation, which provides actions to interact with [Safe](https://safe.global/) multi-signature wallets on EVM-compatible blockchains.

## Directory Structure

```
safe/
├── safeApiActionProvider.ts         # Provider for Safe API interactions
├── safeWalletActionProvider.ts      # Provider for Safe Wallet operations
├── schemas.ts                       # Action schemas for Safe operations
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

### Safe API Actions

- `safeInfo`: Retrieve detailed information about a Safe wallet
- `getAllowanceInfo`: Get current allowance configurations
- `withdrawAllowance`: Withdraw funds from an allowance

### Safe Wallet Actions

- `addSigner`: Add a new signer to a Safe wallet
- `removeSigner`: Remove an existing signer from a Safe wallet
- `changeThreshold`: Modify the number of required signatures
- `approvePending`: Approve a pending transaction
- `enableAllowanceModule`: Activate the allowance module for a Safe
- `setAllowance`: Configure spending allowances for specific addresses

## Adding New Actions

To add new Safe actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in the appropriate provider file:
   - Safe API actions in `safeApiActionProvider.ts`
   - Safe Wallet actions in `safeWalletActionProvider.ts`
3. Add corresponding tests

## Network Support

The Safe providers support all EVM-compatible networks, including:

- Ethereum (Mainnet & Testnets)
- Base (Mainnet & Testnets)
- Optimism
- Arbitrum
- Optimism
- And other EVM-compatible networks

## Notes

- safeWalletActionProvider requires a safeWalletProvider
- safeWalletProvider connects to an existing Safe account or automatically creates a new one with the provided private key as single signer
- Safe API actions can be used with other evmWalletProvider

For more information on Safe multi-signature wallets visit [Safe Documentation](https://docs.safe.global/).