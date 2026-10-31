# PumpClaw Action Provider

This directory contains the **PumpclawActionProvider** implementation, which provides actions to interact with the **PumpClaw protocol** on Base mainnet.

## Directory Structure

```
pumpclaw/
├── pumpclawActionProvider.ts         # Main provider with PumpClaw functionality
├── pumpclawActionProvider.test.ts    # Test file for PumpClaw provider
├── constants.ts                      # PumpClaw contract constants and ABIs
├── schemas.ts                        # PumpClaw action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `create_token`: Create a new token via PumpClaw factory with Uniswap V4 liquidity
- `get_token_info`: Get detailed information about a PumpClaw token
- `list_tokens`: List all tokens created on PumpClaw
- `buy_token`: Buy tokens with ETH via SwapRouter
- `sell_token`: Sell tokens for ETH via SwapRouter
- `set_image_url`: Update token image (creator only)

## Adding New Actions

To add new PumpClaw actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `pumpclawActionProvider.ts`
3. Add tests in `pumpclawActionProvider.test.ts`

## Network Support

The PumpClaw provider supports Base mainnet only.

## Contract Addresses

- **Factory**: `0xe5bCa0eDe9208f7Ee7FCAFa0415Ca3DC03e16a90` (Base mainnet)
- **SwapRouter**: `0x3A9c65f4510de85F1843145d637ae895a2Fe04BE` (Base mainnet)

## Notes

PumpClaw is a token launcher on Base that uses Uniswap V4 for liquidity provisioning. Liquidity is locked at creation time and trading fees are split between the token creator and protocol.

For more information, visit [pumpclaw.com](https://pumpclaw.com).
