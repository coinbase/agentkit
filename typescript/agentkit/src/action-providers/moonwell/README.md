# Moonwell Action Provider

This directory contains the **MoonwellActionProvider** implementation, which provides actions to interact with the **Moonwell Protocol** for lending and borrowing operations.

## Directory Structure

```
moonwell/
├── moonwellActionProvider.ts         # Main provider with Moonwell functionality
├── moonwellActionProvider.test.ts    # Test file for Moonwell provider
├── constants.ts                      # Protocol constants and ABIs
├── schemas.ts                        # Lending/borrowing action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `mint`: Deposit assets into a Moonwell MToken
- `redeem`: Redeem assets from a Moonwell MToken

## Adding New Actions

To add new Moonwell actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `moonwellActionProvider.ts`
3. Add tests in `moonwellActionProvider.test.ts`

## Network Support

The Moonwell provider supports Base mainnet and Base sepolia.

## Notes

For more information on the **Moonwell Protocol**, visit [Moonwell Documentation](https://docs.moonwell.fi/).
