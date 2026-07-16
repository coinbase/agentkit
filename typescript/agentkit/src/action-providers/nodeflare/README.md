# NodeFlare Action Provider

This directory contains the **NodeflareActionProvider** implementation, which provides actions to read on-chain data across **23 EVM chains** through [NodeFlare](https://nodeflare.app)'s public RPC gateway — Ethereum, Base, BNB Chain, Arbitrum, Optimism, Avalanche, HyperEVM, Polygon, and young chains like Robinhood Chain, Plasma, Ink, Zircuit, BOB and Soneium.

Unlike a wallet-bound provider, every action takes an explicit `chain` argument (slug, name, **or** chain ID), so an agent can query any supported chain without configuring a separate RPC per chain. All actions are read-only and keyless — the injected wallet provider is not used.

## Directory Structure

```
nodeflare/
├── nodeflareActionProvider.ts        # Main provider with NodeFlare read actions
├── nodeflareActionProvider.test.ts   # Test file for NodeFlare provider
├── schemas.ts                        # Action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `get_supported_chains`: List the EVM chains NodeFlare serves, with chain IDs and native currencies
- `get_block_number`: Get the latest block number on any supported chain
- `get_native_balance`: Get the native gas-token balance of an address (ETH, BNB, POL, SEI, …), human-readable
- `get_erc20_balance`: Read an ERC-20 token balance for a holder, human-readable using the token's decimals
- `get_token_metadata`: Read ERC-20 token metadata (name, symbol, decimals, total supply)
- `get_gas_price`: Get the current gas price on a chain, in gwei
- `get_transaction`: Look up a transaction by hash (from, to, value, block)

Every action's `chain` argument accepts a slug (`base`), a name (`ethereum`, `bsc`), or a numeric chain ID (`8453`).

## Adding New Actions

To add new NodeFlare actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `nodeflareActionProvider.ts`
3. Add tests in `nodeflareActionProvider.test.ts`

## Network Support

The provider reads any of NodeFlare's 23 supported EVM chains, selected per-action via the `chain` argument, so it is available regardless of the network the host agent's wallet is configured for. For the full list and endpoints, see the [NodeFlare chains directory](https://nodeflare.app/chains).

## Notes

- **No API key required.** Actions use NodeFlare's free public read tier. Heavy methods (`eth_getLogs`, trace) are not exposed here; for those, use the [NodeFlare MCP server](https://github.com/Nodeflare-app/nodeflare-mcp) with a free API key.
- Read-only: this provider does not send transactions or touch the agent's wallet.

For more information, visit the [NodeFlare docs for AI agents](https://nodeflare.app/agents).
