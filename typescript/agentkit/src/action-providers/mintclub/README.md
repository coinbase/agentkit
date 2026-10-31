# Mint Club V2 Action Provider

This directory contains the **MintclubActionProvider** implementation, which provides actions to interact with the **Mint Club V2 protocol** on Base mainnet.

## Directory Structure

```
mintclub/
├── mintclubActionProvider.ts         # Main provider with Mint Club V2 functionality
├── mintclubActionProvider.test.ts    # Test file for Mint Club provider
├── constants.ts                      # Mint Club contract constants and ABIs
├── schemas.ts                        # Mint Club action schemas
├── utils.ts                          # Mint Club utility functions
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `get_token_info`: Get detailed information about a Mint Club token including bonding curve details
- `get_token_price`: Get the current price of a Mint Club token in reserve tokens and USD
- `buy_token`: Buy Mint Club tokens via the bonding curve mechanism
- `sell_token`: Sell Mint Club tokens via the bonding curve mechanism
- `create_token`: Create a new Mint Club token with bonding curve

## Adding New Actions

To add new Mint Club actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `mintclubActionProvider.ts`
3. Add tests in `mintclubActionProvider.test.ts`

## Network Support

The Mint Club provider supports Base mainnet only.

## Notes

Mint Club V2 is a bonding curve token protocol that allows anyone to create tokens backed by reserve assets. The protocol uses mathematical curves to determine token prices based on supply and demand.

For more information on the **Mint Club V2 protocol**, visit [Mint Club Documentation](https://mint.club/).
