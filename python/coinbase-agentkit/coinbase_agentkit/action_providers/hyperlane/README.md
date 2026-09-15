# Hyperlane Action Provider

This directory contains the **HyperlaneActionProvider** implementation, which provides actions for cross-chain ERC-20 token transfers via [Hyperlane](https://hyperlane.xyz/) Warp Routes.

## Directory Structure

```
hyperlane/
├── hyperlane_action_provider.py   # Hyperlane action provider
├── constants.py                   # Domain IDs and Warp Route ABI
├── schemas.py                     # Action input schemas
├── utils.py                       # Encoding and ERC-20 helpers
├── __init__.py                    # Main exports
└── README.md                      # This file

# From python/coinbase-agentkit/
tests/action_providers/hyperlane/
├── conftest.py                    # Test fixtures
├── test_hyperlane_provider.py     # Provider-level tests
├── test_hyperlane_schemas.py      # Schema validation tests
└── test_hyperlane_transfer.py     # transfer_remote action tests
```

## Actions

- `transfer_remote`: Bridge an ERC-20 to a recipient on another chain via a Hyperlane Warp Route.
- `quote_transfer_remote`: Preview the interchain gas payment for a Warp Route transfer to a destination chain.

## Network Support

Origin chains (the network the current wallet is connected to):

- Base Mainnet (`base-mainnet`)
- Ethereum Mainnet (`ethereum-mainnet`)
- Optimism Mainnet (`optimism-mainnet`)
- Arbitrum Mainnet (`arbitrum-mainnet`)

Destination chains are resolved by name to Hyperlane domain IDs. Supported destinations include `ethereum`, `optimism`, `bsc`, `gnosis`, `polygon`, `base`, `arbitrum`, `celo`, `avalanche`, `mantle`, `mode`, `linea`, `scroll`, and `zora`.

## Notes

- Warp Route addresses differ per (origin chain, token) pair. Find them in the [Hyperlane Registry](https://github.com/hyperlane-xyz/hyperlane-registry/tree/main/deployments/warp_routes).
- Interchain gas is read from the Warp Route via `quoteGasPayment(uint32)` and attached as `msg.value` on `transferRemote`.
- The Warp Route is approved to spend the underlying ERC-20 before each transfer.
