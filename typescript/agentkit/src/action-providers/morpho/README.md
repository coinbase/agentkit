# Morpho Action Provider

This directory contains the **MorphoActionProvider** implementation, which provides actions to interact with **Morpho Protocol** for optimized lending and borrowing operations.

## Directory Structure

```
morpho/
├── morphoActionProvider.ts         # Main provider with Morpho functionality
├── morphoActionProvider.test.ts    # Test file for Morpho provider
├── constants.ts                    # Protocol constants and ABIs
├── schemas.ts                      # Lending/borrowing action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `deposit`: Deposit assets into a Morpho Vault
- `withdraw`: Withdraw assets from a Morpho Vault

## Adding New Actions

To add new Morpho actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `morphoActionProvider.ts`
3. Add tests in `morphoActionProvider.test.ts`

## Network Support

The Morpho provider supports Base mainnet and Base sepolia.

## Notes

For more information on the **Morpho Protocol**, visit [Morpho Documentation](https://docs.morpho.org/).
