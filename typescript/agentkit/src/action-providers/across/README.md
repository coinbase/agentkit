# Across Action Provider

This directory contains the **AcrossActionProvider** implementation, which provides actions to interact with the **Across Protocol** for bridging tokens across multiple EVM chains.

## Directory Structure

```
across/
├── acrossActionProvider.ts        # Main provider with Across Protocol functionality
├── acrossActionProvider.test.ts        # Tests
├── schemas.ts                     # Bridge token schema
├── utils.ts                       # Utility functions for Across integration
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `bridge_token`: Bridge tokens from one chain to another using the Across Protocol

## Adding New Actions

To add new Across actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `acrossActionProvider.ts`
3. Add tests in `acrossActionProvider.test.ts`

## Network Support

The Across provider supports EVM-compatible chains, for example:
- Ethereum Mainnet and Sepolia
- Base Mainnet and Sepolia

## Configuration

The provider requires the following configuration:
- `privateKey`: Private key of the signer
- `networkId`: (Optional) Network ID to use, e.g., "base-sepolia" or "ethereum-mainnet"

## Notes

For more information on the **Across Protocol**, visit [Across Protocol Documentation](https://docs.across.to/). 