# Sushi Action Provider

This directory contains the **SushiRouterActionProvider** and **SushiDataActionProvider**, which wrap Sushi APIs so agents can discover tokens and execute swaps on EVM-compatible networks.

## Directory Structure

```
sushi/
├── constants.ts                      # Shared constants (Route event ABI)
├── index.ts                          # Barrel exports for the provider
└── README.md                         # This file
├── sushiDataActionProvider.ts        # Sushi Data API actions (token discovery)
├── sushiDataSchemas.ts               # Input schemas for data actions
├── sushiRouterActionProvider.test.ts # Tests for router actions
├── sushiRouterActionProvider.ts      # Sushi Router API actions (quotes and swaps)
├── sushiRouterSchemas.ts             # Input schemas for router actions
```

## Actions

- `quote`
  - Fetches an off-chain quote for swapping a `from` token into a `to` token using the Sushi Swap API.
  - Accepts human-readable amounts and token addresses (use `nativeAddress` for the native asset).
  - Returns a formatted summary of the route status and expected in/out amounts.

- `swap`
  - Executes a routed swap through Sushi after validating quotes, balances, and ERC20 approvals.
  - Handles native token vs ERC20 flows, submits the transaction via the wallet, and returns the hash plus an explorer link.

- `find-token`
  - Searches the Sushi Data API for up to 10 tokens by symbol (full or partial) or address.
  - Useful for verifying token metadata and addresses before quoting or swapping.

## Adding New Actions

1. Define the input schema in `sushiRouterSchemas.ts` or `sushiDataSchemas.ts` as appropriate. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema).
2. Implement the action in `sushiRouterActionProvider.ts` or `sushiDataActionProvider.ts`.
3. Add or update tests (e.g. `sushiRouterActionProvider.test.ts`) to cover the new behaviour.

## Network Support

- **Router actions** (`quote`, `swap`) are available on EVM networks supported by the Sushi Swap API (`isSwapApiSupportedChainId`).
- **Data actions** (`find-token`) work on EVM networks recognised by the Sushi Data API (`isEvmChainId`).

## Notes

- Refer to the [Sushi Docs](https://www.sushi.com/docs) for additional context.
