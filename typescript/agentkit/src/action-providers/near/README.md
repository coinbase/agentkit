# NEAR Action Provider

This directory contains the **NearActionProvider** implementation, which provides actions to interact with the [NEAR Protocol Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures), that allows a NEAR protocol account to control other accounts/addresses across multiple chains.

## Directory Structure

```
near/
├── nearActionProvider.ts             # Main provider with Chain signatures functionality
├── nearActionProvider.test.ts        # Test file for Near action provider
├── constants.ts                      # Constants and addresses of the MPC signer
├── schemas.ts                        # Action schemas
├── types.ts                          # Types  
├── utils/address.ts                  # Address utilities for chain signatures
├── utils/mpcContract.ts              # Utilities to interact with the MPC contract
├── utils/nearChainSignature.ts       # Utilities for deriving addreses
├── utils/nearChainSignature.test.ts  # Test file for Near chain signature utilities    
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `get_cross_chain_address`: Compute a cross chain address
- `get_cross_chain_public_key`: Compute a cross chain public key
- `sign_payload`: Signs a transaction payload

## Adding New Actions

To add new NEAR chain signatures actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `nearActionProvider.ts`
3. Add tests in `nearActionProvider.test.ts`

## Network Support

The Morpho provider supports `near-testnet` and `near-mainnet`.

## Notes

For more information about **Chain Signatures**, visit [Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures)
