# Pyth Action Provider

This directory contains the **PythActionProvider** implementation, which provides actions to interact with the **Pyth Network** for real-time price oracle data.

## Directory Structure

```
pyth/
├── pythActionProvider.ts         # Main provider with Pyth functionality
├── pythActionProvider.test.ts    # Test file for Pyth provider
├── schemas.ts                    # Price feed action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `fetch_price_feed`: Fetch the price feed ID for a given asset
- `fetch_price`: Fetch the price for a given asset, by price feed ID
  - Can be chained with `fetch_price_feed` to fetch the price feed ID first

## Supported Asset Types

The Pyth action provider supports multiple asset classes:

### Crypto
- Examples: BTC, ETH, SOL
- Default asset type

### Equities
- Examples: Coin (Coinbase), AAPL (Apple), TSLA (Tesla)

### Foreign Exchange (FX)
- Examples: EUR (Euro), GBP (British Pound), JPY (Japanese Yen)

### Metals
- Examples: XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)

## Usage Examples

```typescript
// Fetch crypto price feed ID
const cryptoResult = await provider.fetchPriceFeed({
  tokenSymbol: "BTC",
  assetType: "crypto"
});

// Fetch gold price feed ID
const goldResult = await provider.fetchPriceFeed({
  tokenSymbol: "XAU",
  assetType: "metal"
});

// Fetch Coinbase stock price feed ID
const stockResult = await provider.fetchPriceFeed({
  tokenSymbol: "COIN",
  assetType: "equities"
});

// Fetch EUR/USD price feed ID
const fxResult = await provider.fetchPriceFeed({
  tokenSymbol: "EUR",
  assetType: "fx"
});
```

## Adding New Actions

To add new Pyth actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `pythActionProvider.ts`
3. Add tests in `pythActionProvider.test.ts`

## Network Support

Pyth supports many blockchains. For more information, visit [Pyth Documentation](https://docs.pyth.network/home).
