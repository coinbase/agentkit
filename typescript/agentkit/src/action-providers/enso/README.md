# Enso Action Provider

This directory contains the **EnsoActionProvider** implementation, which provides actions to interact with the **Enso** API for executing complex DeFi routes and token swaps across multiple blockchain networks.

## Directory Structure

```
enso/
├── ensoActionProvider.ts         # Main provider with Enso routing functionality
├── ensoActionProvider.test.ts    # Test file for Enso provider
├── constants.ts                  # Constants for Enso provider
├── schemas.ts                    # Enso action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `route`: Finds the optimal route for entering or exiting any DeFi position or swap between any ERC20 tokens efficiently.

## Parameters

### Route Action Parameters

- `tokenIn`: Address of the token to swap from (for ETH, use `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`)
- `tokenOut`: Address of the token to swap to (for ETH, use `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`)
- `amountIn`: Amount of tokenIn to swap in whole units (e.g., "100 USDC")
- `slippage`: Optional slippage tolerance in basis points (1/10000). Default is 50 (0.5%)

## Network Support

The Enso provider supports the following networks:

- **Ethereum**: Chain ID 1
- **Optimism**: Chain ID 10
- **BNB Chain**: Chain ID 56
- **Gnosis Chain**: Chain ID 100
- **Unichain**: Chain ID 130
- **Polygon**: Chain ID 137
- **Sonic**: Chain ID 146
- **World Chain**: Chain ID 480
- **HyperEVM**: Chain ID 999
- **Soneium**: Chain ID 1868
- **Base**: Chain ID 8453
- **Arbitrum**: Chain ID 42161
- **Avalanche**: Chain ID 43114
- **Ink**: Chain ID 57073
- **Linea**: Chain ID 59144
- **Berachain**: Chain ID 80094
- **Plume**: Chain ID 98866
- **Katana**: Chain ID 747474

## Adding New Actions

To add new Enso actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `ensoActionProvider.ts`
3. Add tests in `ensoActionProvider.test.ts`

## Configuration

The Enso provider uses a default API key for demonstration purposes. For production use, you can provide your own API key:

```typescript
const ensoProvider = new EnsoActionProvider({
  apiKey: "your-enso-api-key"
});
```

## Notes

For more information on **Enso**, visit [Enso Documentation](https://docs.enso.finance/).

