# WOW Action Provider

This directory contains the **WowActionProvider** implementation, which provides actions to interact with the **Wow protocol** on Base mainnet and Base sepolia.

## Directory Structure

```
wow/
├── uniswap/
│   ├── constants.ts             # Uniswap contract constants and ABI
│   └── utils.ts                 # Uniswap utility functions
├── wowActionProvider.ts         # Main provider with Wow functionality
├── wowActionProvider.test.ts    # Test file for Wow provider
├── constants.ts                 # Wow contract constants and ABI
├── schemas.ts                   # Wow action schemas
├── utils.ts                     # Wow utility functions
├── index.ts                     # Main exports
└── README.md                    # This file
```

## Actions

- `buy_token`: Buy a Zora Wow ERC20 memecoin with ETH.
- `create_token`: Create a Zora Wow ERC20 memecoin.
- `sell_token`: Sell a Zora Wow ERC20 memecoin.

## Adding New Actions

To add new Wow actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `wowActionProvider.ts`
3. Add tests in `wowActionProvider.test.ts`

## Network Support

The Wow provider supports Base mainnet and Base sepolia.

## Notes

For more information on the **Wow protocol**, visit [Wow Documentation](https://wow.xyz/).
