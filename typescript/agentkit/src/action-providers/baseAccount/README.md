# Base Account Action Provider

This directory contains the **BaseAccountActionProvider** implementation, which provides actions to interact with **Base Account spend permissions** on Base mainnet.

## Directory Structure

```
baseAccount/
├── baseAccountActionProvider.ts       # Main provider with Base Account functionality
├── baseAccountActionProvider.test.ts  # Test file for Base Account provider
├── schemas.ts                         # Base Account action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `list_base_account_spend_permissions`: List spend permissions granted by a Base Account

  - Takes a Base Account address and returns spend permissions where the current wallet is the spender
  - Returns **spend permissions for any ERC20 token** with details like allowance, period, timestamps, and token information
  - Automatically formats token amounts using proper decimals and displays token names
  - Useful to see what spending allowances have been granted before using them

- `spend_from_base_account_permission`: Use a spend permission to transfer tokens

  - Takes a Base Account address and optionally an amount, token address, and permission index
  - Automatically finds and uses the specified or first valid spend permission
  - Supports **any ERC20 token** with spend permissions (not just USDC)
  - If no amount is specified, withdraws the full remaining allowance
  - Transfers tokens from the Base Account to the current wallet
  - Returns transaction details upon success

- `revoke_base_account_spend_permission`: Revoke a spend permission

  - Takes a Base Account address and optionally a permission index
  - Permanently revokes the specified spend permission
  - Supports **any ERC20 token** with spend permissions
  - Returns **transaction hash** upon success

## Adding New Actions

To add new Base Account actions:

1. Define your action schema in `schemas.ts`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema) for more information.
2. Implement the action in `baseAccountActionProvider.ts` using the `@CreateAction` decorator
3. Implement tests in `baseAccountActionProvider.test.ts`

## Network Support

The Base Account provider only supports **Base mainnet** (`base-mainnet`), as Base Account spend permissions are specifically designed for this network.

## Notes

- Base Account spend permissions support **any ERC20 token** (not limited to USDC)
- Users must grant permissions through the Base Account UI before they can be used
- All spend operations automatically find and use valid permissions
- Permissions have time-based limits and spending allowances
- Token amounts are automatically formatted with proper decimals and display token names
- If no specific amount is provided, the full remaining allowance will be used

For more information on **Base Account spend permissions**, visit [Base Account Documentation](https://docs.base.org/base-account).
