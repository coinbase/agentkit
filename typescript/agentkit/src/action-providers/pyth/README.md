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

- `fetch_price_feed_id`: Fetch the price feed ID for a given asset
- `fetch_price`: Fetch the price for a given asset, by price feed ID
  - Can be chained with `fetch_price_feed_id` to fetch the price feed ID first

## Adding New Actions

To add new Pyth actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `pythActionProvider.ts`
3. Add tests in `pythActionProvider.test.ts`

## Network Support

Pyth supports many blockchains. For more information, visit [Pyth Documentation](https://docs.pyth.network/home).
