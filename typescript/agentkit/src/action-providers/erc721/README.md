# ERC721 Action Provider

This directory contains the **ERC721ActionProvider** implementation, which provides actions to interact with **ERC721 NFT tokens** on EVM-compatible networks.

## Directory Structure

```
erc721/
├── erc721ActionProvider.ts         # Main provider with NFT functionality
├── erc721ActionProvider.test.ts    # Test file for ERC721 provider
├── constants.ts                    # ERC721 contract constants and ABI
├── schemas.ts                      # NFT action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `get_balance`: Get NFT balance for an address
- `transfer`: Transfer an NFT to another address
- `mint`: Mint a new NFT

## Adding New Actions

To add new ERC721 actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `erc721ActionProvider.ts`
3. Add tests in `erc721ActionProvider.test.ts`

## Network Support

The ERC721 provider supports all EVM-compatible networks.

## Notes

For more information on the **ERC721 token standard**, visit [ERC721 Token Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-721/).
