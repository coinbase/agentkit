# OKX DEX Action Provider

This directory contains the **OKXDexActionProvider** implementation, which provides actions to interact with **OKX's DEX API** for token swaps and related operations.

## Directory Structure

```
okx/
├── OKXDexActionProvider.ts         # Main provider with OKX DEX functionality
├── OKX_Quote.test.ts              # Test file for OKX DEX provider
├── schemas.ts                      # Quote action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `get_swap_quote`: Get token swap quotes from OKX DEX
  - Returns quote details for swapping one token for another
  - Includes exchange rate, expected output, gas estimates, and price impact
  - Supports multiple EVM chains including Ethereum, BSC, Polygon, etc.

## Network Support

The OKX DEX API supports the following EVM networks:
- Ethereum (Chain ID: 1)
- BSC (Chain ID: 56)
- Polygon (Chain ID: 137)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Avalanche (Chain ID: 43114)
- Base (Chain ID: 8453)
- Polygon zkEVM (Chain ID: 1101)

## Adding New Actions

To add new OKX DEX actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `OKXDexActionProvider.ts`
3. Add tests in `OKX_Quote.test.ts`

## Configuration

Requires the following environment variables or configuration options:
- `OKX_API_KEY`: Your OKX API key
- `OKX_SECRET_KEY`: Your OKX secret key
- `OKX_API_PASSPHRASE`: Your OKX API passphrase
- `OKX_PROJECT_ID`: Your OKX project ID

Visit the [OKX DEX Documentation](https://web3.okx.com/build/docs/waas/dex-introduction) for more information on obtaining API credentials and usage details.
