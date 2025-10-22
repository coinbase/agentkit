# SPL Token Action Provider

This directory contains the **SplActionProvider** implementation, which provides actions to interact with **Solana Program Library (SPL) tokens** on the Solana blockchain.

## Directory Structure

```
spl/
├── splActionProvider.ts         # Main provider with SPL token functionality
├── splActionProvider.test.ts    # Test file for SPL provider
├── schemas.ts                   # Token action schemas
├── index.ts                     # Main exports
└── README.md                    # This file
```

## Actions

- `transfer`: Transfer SPL tokens

  - Handles ATA (Associated Token Account) creation

- `get_balance`: Get SPL token balance

  - Returns human-readable balance with decimals

## Adding New Actions

To add new SPL actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `splActionProvider.ts`
3. Add tests in `splActionProvider.test.ts`

## Network Support

The SPL provider supports any Solana network.

## Notes

For more information on **SPL Tokens**, visit [Solana SPL Documentation](https://spl.solana.com/token).
