# WETH Action Provider

This directory contains the **WethActionProvider** implementation, which provides actions to interact with **Wrapped Ether (WETH)** contracts on Base mainnet and Base sepolia.

## Directory Structure

```
weth/
├── wethActionProvider.ts         # Main provider with WETH functionality
├── wethActionProvider.test.ts    # Test file for WETH provider
├── constants.ts                  # WETH contract constants and ABI
├── schemas.ts                    # WETH action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `wrap_eth`: Convert ETH to WETH

## Adding New Actions

To add new WETH actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `wethActionProvider.ts`
3. Add tests in `wethActionProvider.test.ts`

## Network Support

The WETH provider supports Base mainnet and Base sepolia.

## Notes

For more information on **Wrapped Ether**, visit [Wrapped Ether Documentation](https://ethereum.org/en/wrapped-eth/).
