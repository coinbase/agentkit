# Farcaster Action Provider

This directory contains the **FarcasterActionProvider** implementation, which provides actions to interact with the **Farcaster Protocol** for social media operations.

## Directory Structure

```
farcaster/
├── farcasterActionProvider.ts         # Main provider with Farcaster functionality
├── farcasterActionProvider.test.ts    # Test file for Farcaster provider
├── schemas.ts                         # Farcaster action schemas
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `account_details`: Get the details of the Farcaster account

  - Accepts the FID of the Farcaster account to get details for

- `post_cast`: Create a new Farcaster post

## Adding New Actions

To add new Farcaster actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `farcasterActionProvider.ts`
3. Add tests in `farcasterActionProvider.test.ts`

## Network Support

The Farcaster provider supports all EVM-compatible networks.

## Notes

- Requires a Neynar API key. Visit the [Neynar Dashboard](https://dev.neynar.com/) to get your key.

For more information on the **Farcaster Protocol**, visit [Farcaster Documentation](https://docs.farcaster.xyz/).
