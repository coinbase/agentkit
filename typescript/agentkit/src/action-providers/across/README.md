# Across Action Provider

This directory contains the **AcrossActionProvider** implementation, which provides actions to interact with the **Across Protocol** for bridging tokens across multiple EVM chains.

## Directory Structure

```
across/
├── acrossActionProvider.ts        # Main provider with Across Protocol functionality
├── acrossActionProvider.test.ts   # Tests
├── schemas.ts                     # Bridge token schema
├── utils.ts                       # Utility functions for Across integration
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `bridge_token`: Bridge tokens from one chain to another using the Across Protocol
- `check_deposit_status`: Check the status of a cross-chain bridge deposit on the Across Protocol 

## Adding New Actions

To add new Across actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `acrossActionProvider.ts`
3. Add tests in `acrossActionProvider.test.ts`

## Network Support

The Across provider supports cross-chain transfers between EVM-compatible chains, for example:
- Ethereum Mainnet to Base Mainnet
- Base Sepolia to Ethereum Sepolia
The status of bridge deposit can only be checked on Mainnets.

## ⚠️ Warning

Before briding funds, always make sure that you have access to the destination address on the destination chain!

Note that when using a CDP server wallet with CdpWalletProvider, a new wallet address is generated for each chain. This means that if you bridge tokens to the sender's address on one chain, you may not be able to access those funds on the destination chain within AgentKit since a different wallet address will be used. 
While you can export the private key to access funds in external wallets, it's recommended to either use ViemWalletProvider for consistent addresses across chains or ensure the destination address is different from the sender's address.

## Configuration

The provider requires the following configuration:
- `privateKey`: Private key of the wallet provider

## Notes

For more information on the **Across Protocol**, visit [Across Protocol Documentation](https://docs.across.to/). 