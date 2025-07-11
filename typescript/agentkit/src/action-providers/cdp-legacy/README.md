# CDP (Coinbase Developer Platform) Action Provider

This directory contains the **CdpActionProvider** implementation, which provides actions to interact with the **Coinbase Developer Platform (CDP)** API and wallet services.

## Directory Structure

```
cdp/
├── cdpApiActionProvider.ts            # Provider for CDP API interactions
├── cdpWalletActionProvider.ts         # Provider for CDP Wallet operations
├── cdpApiActionProvider.test.ts       # Tests for CDP API provider
├── cdpWalletActionProvider.test.ts    # Tests for CDP Wallet provider
├── constants.ts                       # CDP contract constants and ABI
├── schemas.ts                         # Action schemas for CDP operations
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

### CDP API Actions

- `address_reputation`: Returns onchain activity metrics

- `request_faucet_funds`: Request testnet funds from CDP faucet

  - Available only on Base Sepolia

### CDP Wallet Actions

- `deploy_contract`: Deploy a smart contract
- `deploy_nft`: Deploy an NFT
- `deploy_token`: Deploy a token
- `trade`: Trade a token

  - Available only on mainnet networks

## Adding New Actions

To add new CDP actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in the appropriate provider file:
   - CDP API actions in `cdpApiActionProvider.ts`
   - CDP Wallet actions in `cdpWalletActionProvider.ts`
3. Add corresponding tests

## Network Support

The CDP providers support all networks available on the Coinbase Developer Platform, including:

- Base (Mainnet & Testnet)
- Ethereum (Mainnet & Testnet)
- Other EVM-compatible networks

## Notes

- Requires CDP API credentials (API Key ID and Secret). Visit the [CDP Portal](https://portal.cdp.coinbase.com/) to get your credentials.

For more information on the **Coinbase Developer Platform**, visit [CDP Documentation](https://docs.cdp.coinbase.com/).
