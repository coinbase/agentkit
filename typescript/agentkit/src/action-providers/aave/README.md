# Aave Action Provider

This directory contains the **AaveActionProvider** implementation, which provides actions to interact with the **Aave V3 Protocol** for supply/withdraw (lending) operations.

## Directory Structure

```
aave/
├── aaveActionProvider.ts       # Main provider with Aave V3 supply/withdraw functionality
├── aaveActionProvider.test.ts  # Test file for Aave provider
├── constants.ts                # Protocol addresses & ABI
├── schemas.ts                  # Supply/withdraw action schemas
├── index.ts                    # Main exports
└── README.md                   # This file
```

## Actions

- `supply`: Supply (deposit) an ERC-20 asset into the Aave V3 lending pool
- `withdraw`: Withdraw a previously supplied ERC-20 asset from the Aave V3 lending pool

## Adding New Actions

To add new Aave actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `aaveActionProvider.ts`
3. Add tests in `aaveActionProvider.test.ts`

## Network Support

The Aave provider supports Base mainnet and Base Sepolia.

## Notes

- This provider talks to the Aave V3 `Pool` contract directly via a minimal ABI (only `supply`/`withdraw`) using `viem` — it does not depend on `@aave/contract-helpers` or `ethers`, to stay consistent with the rest of AgentKit's wallet-provider-agnostic, viem-based design.
- Only ERC-20 reserves are supported (no native ETH via the `WETHGateway`) in this initial version.
- For more information on the **Aave Protocol**, visit [Aave Documentation](https://docs.aave.com/).
