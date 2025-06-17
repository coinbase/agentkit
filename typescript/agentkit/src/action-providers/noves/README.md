# Noves Action Provider

This directory contains the **NovesActionProvider** implementation, which provides actions to interact with **Noves Intents** for retrieving token prices, transaction descriptions, and recent transactions.

## Directory Structure

```
noves/
├── novesActionProvider.ts                      # Main provider with Noves Intents functionality
├── novesActionProvider.test.ts                 # Test file for Noves provider
├── schemas.ts                                  # Noves action schemas
├── index.ts                                    # Main exports
└── README.md                                   # This file
```

## Actions

- `getTranslatedTransaction`: Get a human-readable description of a transaction for specified transaction hash and network

- `getRecentTransactions`: Get a list of recent transactions on a given chain for a given wallet, with a human-readable description

- `getTokenCurrentPrice`: Get the price of a token at the given timestamp, or the current price if no timestamp is provided

## Adding New Actions

To add new Alchemy actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `novesActionProvider.ts`
3. Add tests in `novesActionProvider.test.ts`

## Network Support

Noves Intents support 100+ blockchain networks. For more information, visit [Noves](https://www.noves.fi/).

## Notes

- Rate limits applied

For more information on the **Noves API**, visit [Noves API Documentation](https://docs.noves.fi/reference/api-overview).
