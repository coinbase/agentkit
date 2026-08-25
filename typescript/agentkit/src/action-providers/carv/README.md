# CARV Action Provider

This directory contains the **CarvActionProvider** implementation, which provides actions to interact with the **CARV Protocol API** for social identity to blockchain address resolution.

## Directory Structure
```
carv/
├── carvActionProvider.ts         # Main provider
├── carvActionProvider.test.ts    # Test file for CARV provider
├── schemas.ts                    # CARV action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `get_address_by_discord_id`: Get user's wallet address by Discord ID
- `get_address_by_twitter_id`: Get user's wallet address by Twitter ID/username
- `get_balance_by_discord_id`: Get user's token balance by Discord ID
- `get_balance_by_twitter_id`: Get user's token balance by Twitter ID/username

## Adding New Actions

To add new CARV actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `carvActionProvider.ts` with the `@CreateAction` decorator
3. Add tests in `carvActionProvider.test.ts`

## Network Support

The CARV provider is network-agnostic and works with any blockchain network supported by AgentKit.

## Configuration

Requires CARV API key:
```typescript
new CarvActionProvider({
  apiKey: process.env.CARV_API_KEY,
});
```

## Supported Chains
- Ethereum
- Base

## Notes

- Requires CARV API credentials
- Returns both wallet address and token balance
- Supports multiple chains and tokens

For more information on the CARV Protocol, and to get API credentials, visit [CARV Protocol Doc](https://docs.carv.io/d.a.t.a.-ai-framework/api-documentation).