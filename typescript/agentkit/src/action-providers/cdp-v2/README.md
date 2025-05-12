# CDP (Coinbase Developer Platform) V2 Action Provider

This directory contains the **CdpV2ActionProvider** implementation, which provides actions to interact with the **Coinbase Developer Platform (CDP)** API and wallet services.

## Directory Structure

```
cdp/
├── cdpApiV2ActionProvider.ts          # Provider for CDP API interactions
├── cdpApiV2ActionProvider.test.ts     # Tests for CDP API provider
├── schemas.ts                         # Action schemas for CDP operations
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

### CDP API Actions

- `request_faucet_funds`: Request testnet funds from CDP faucet

  - Available only on Base Sepolia, Ethereum Sepolia or Solana Devnet

## Adding New Actions

To add new CDP actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in the appropriate provider file:
   - CDP API actions in `cdpApiActionProvider.ts`
3. Add corresponding tests

## Network Support

The CDP providers support all networks available on the Coinbase Developer Platform, including:

- Base (Mainnet & Testnet)
- Ethereum (Mainnet & Testnet)
- Other EVM-compatible networks

## Notes

- Requires CDP API credentials (API Key ID and Secret). Visit the [CDP Portal](https://portal.cdp.coinbase.com/) to get your credentials.

For more information on the **Coinbase Developer Platform**, visit [CDP Documentation](https://docs.cdp.coinbase.com/).
