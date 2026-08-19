# Zora Action Provider

This directory contains the **ZoraActionProvider** implementation, which provides actions to interact with the **Zora protocol** for creating cryptocurrencies on the Base blockchain.

## Directory Structure

```
zora/
├── zoraActionProvider.ts         # Main provider with Zora functionality
├── zoraActionProvider.test.ts    # Test file for Zora provider
├── schemas.ts                    # Coin creation schemas
├── utils.ts                      # Utility functions for Zora integration
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `coinIt`: Creates a new coin on the Zora Protocol.

  **Parameters**:

  - `name`: The name of the coin to create
  - `symbol`: The symbol of the coin to create
  - `description`: The description of the coin
  - `image`: Image URI for the coin (`ipfs://` or `https://`)
  - `category` (optional): The category of the coin, defaults to 'social'
  - `payoutRecipient` (optional): The address that will receive creator earnings, defaults to wallet address
  - `platformReferrer` (optional): Platform referrer address that earns referral fees
  - `currency` (optional): The currency to be used for the trading pair (`ZORA` or `ETH`). Defaults to `ZORA`

## Adding New Actions

To add new Zora actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `zoraActionProvider.ts`
3. Add tests in `zoraActionProvider.test.ts`

## Configuration

The provider requires a Pinata JWT for IPFS uploads. This can be provided via:
- Environment variable: `PINATA_JWT`
- Provider configuration: `pinataJwt` parameter

## Network Support

The Zora provider supports the following networks:
- Base Mainnet
- Base Sepolia

## Notes

Coin images must be given as an `https://` URL or an `ipfs://` URI. Local filesystem paths are
not supported: the image is uploaded to Pinata and pinned to public IPFS, so reading
caller-supplied paths would let an agent exfiltrate arbitrary files from the host. To publish a
local file, read it yourself and pass a `data:` URI:

```typescript
image: `data:image/png;base64,${fs.readFileSync("./logo.png", "base64")}`;
```

For more information on the **Zora protocol**, visit [Zora Documentation](https://docs.zora.co/coins). 