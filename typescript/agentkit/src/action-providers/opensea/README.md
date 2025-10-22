# Opensea Action Provider

This directory contains the **OpenseaActionProvider** implementation, which provides actions to interact with the **OpenSea NFT marketplace** for listing and viewing NFTs.

## Directory Structure

```
opensea/
├── openseaActionProvider.ts         # Main provider with OpenSea functionality
├── openseaActionProvider.test.ts    # Test file for OpenSea provider
├── schemas.ts                       # NFT listing and query schemas
├── utils.ts                         # Utility functions for OpenSea integration
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

- `list_nft`: List an NFT for sale on OpenSea
- `get_nfts_by_account`: Fetch NFTs owned by a specific wallet address

## Adding New Actions

To add new OpenSea actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `openseaActionProvider.ts`
3. Add tests in `openseaActionProvider.test.ts`

## Network Support

The OpenSea provider supports the following networks:
- Ethereum Mainnet
- Ethereum Sepolia
- Base
- Arbitrum
- Optimism

## Configuration

The provider requires an OpenSea API key to function. This can be provided via:
- Environment variable: `OPENSEA_API_KEY`
- Provider configuration: `apiKey` parameter

## Notes

For more information on the **OpenSea API**, visit [OpenSea Developer Documentation](https://docs.opensea.io/).
