# Alchemy Action Provider

This directory contains the **AlchemyTokenPricesActionProvider** implementation, which provides actions to interact with **Alchemy's Token API** for retrieving token prices and related data.

## Directory Structure

```
alchemy/
├── alchemyTokenPricesActionProvider.ts         # Main provider with Alchemy token price functionality
├── alchemyTokenPricesActionProvider.test.ts    # Test file for Alchemy provider
├── schemas.ts                                  # Token price action schemas
├── index.ts                                    # Main exports
└── README.md                                   # This file
```

## Actions

- `token_prices_by_symbol`: Get token prices by symbol from Alchemy

  - Returns current prices for specified tokens by symbol (e.g. ETH, BTC, etc.)
  - Supports multiple tokens in a single request
  - Returns balance in USD

- `token_prices_by_address`: Get token prices by address from Alchemy

  - Returns current prices for specified tokens by address
  - Supports multiple tokens in a single request
  - Returns balance in USD

## Adding New Actions

To add new Alchemy actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `alchemyTokenPricesActionProvider.ts`
3. Add tests in `alchemyTokenPricesActionProvider.test.ts`

## Network Support

The Alchemy API supports many blockchain networks. For more information, visit the [Alchemy API Overview](https://docs.alchemy.com/reference/api-overview).

## Notes

- Requires an **Alchemy API Key** for authentication. Visit the [Alchemy Dashboard](https://dashboard.alchemy.com/) to get your key.
- Rate limits apply based on your Alchemy plan

For more information on the **Alchemy Token API**, visit [Alchemy Token API Documentation](https://docs.alchemy.com/reference/token-api-quickstart).
