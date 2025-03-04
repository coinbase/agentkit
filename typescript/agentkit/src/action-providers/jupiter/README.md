# Jupiter Action Provider

This directory contains the **JupiterActionProvider** implementation, which provides actions to interact with the **Jupiter DEX Aggregator** for token swaps on Solana.

## Directory Structure

```
jupiter/
├── jupiterActionProvider.ts         # Main provider with Jupiter swap functionality
├── jupiterActionProvider.test.ts    # Test file for Jupiter provider
├── schemas.ts                       # Swap action schemas
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

- `swap`: Swap tokens using Jupiter
  - Returns transaction signature upon success
  - Automatically handles SOL wrapping/unwrapping

## Adding New Actions

To add new Jupiter actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `jupiterActionProvider.ts`
3. Add tests in `jupiterActionProvider.test.ts`

## Network Support

The Jupiter provider supports Solana mainnet.

## Notes

For more information on the **Jupiter DEX Aggregator**, visit [Jupiter Documentation](https://station.jup.ag/docs/apis/swap-api).
