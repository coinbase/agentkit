# SODAX Action Provider

This directory contains the **SodaxActionProvider**, which lets agents swap tokens through [SODAX](https://sodax.com), an intent-based cross-network execution layer. A swap starts on the EVM network the wallet is connected to and can settle on the same network or on any other network SODAX supports, including non-EVM networks such as Solana. Independent solvers fill the intents; the provider talks to the public [SODAX Swaps HTTP API](https://docs.sodax.com/developers/http-api/swaps) and needs no extra dependency.

## Directory Structure

```
sodax/
├── sodaxActionProvider.ts      # Provider with the SODAX actions
├── sodaxActionProvider.test.ts # Unit tests
├── schemas.ts                  # Input schemas for the actions
├── constants.ts                # API URL, supported networks and defaults
├── types.ts                    # SODAX API request and response types
├── utils.ts                    # API client, token lookup and transaction checks
├── index.ts                    # Barrel exports for the provider
└── README.md                   # This file
```

## Actions

- `get_supported_tokens`
  - Lists the tokens SODAX can swap on a network (symbol, name, address, decimals).
  - Defaults to the wallet's current network; pass a SODAX chain key such as `solana` or `0xa4b1.arbitrum`, or `all` for every network.

- `get_quote`
  - Quotes a swap from the wallet's current network to a destination network, e.g. 10 USDC on Base to USDC on Solana.
  - Tokens can be given by symbol or address and amounts in whole units. Read-only.

- `swap`
  - Builds the swap intent through the SODAX API, sends an ERC20 approval first when the allowance is too low, sends the create-intent transaction from the wallet and hands it to SODAX for relaying and solver execution.
  - The minimum output is the quote minus `slippageBps` (default 100 = 1%). Intents expire after 5 minutes.
  - `destinationAddress` defaults to the wallet address for EVM destinations and is required for non-EVM destinations such as Solana.
  - Before sending anything, the provider checks that each transaction comes from the wallet and that the approval only approves the input token to the contract that receives the swap transaction.

- `get_swap_status`
  - Reports whether a swap is still in progress, `solved` (filled on the destination network) or `failed`, using the source transaction hash returned by `swap`.

## Network Support

Swaps can start on these EVM networks: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, Sonic, HyperEVM, LightLink, Redbelly, Kaia and Robinhood Chain. Destinations include every network SODAX supports, such as Solana, Sui, Stellar, NEAR, Injective, ICON, Stacks, Bitcoin and Hedera. Hedera is supported as a destination but not as a source, because its JSON-RPC relay scales native values differently from other EVM networks. Use `get_supported_tokens` with `chainKey: "all"` for the live list. SODAX is mainnet-only.

## Configuration

```typescript
import { sodaxActionProvider } from "@coinbase/agentkit";

const provider = sodaxActionProvider({
  apiKey: process.env.SODAX_API_KEY, // optional
});
```

- `apiKey` (optional): a SODAX partner API key from the [partner portal](https://portal.sodax.com), sent as the `x-api-key` header. Defaults to the `SODAX_API_KEY` environment variable. The public API accepts requests without a key today; SODAX plans to require one on write routes, so set it for production agents.
- `baseUrl` (optional): override the Swaps API base URL (defaults to `https://api.sodax.com/v1/swaps`).

## Notes

- See the [SODAX docs](https://docs.sodax.com) for the API reference and supported assets.
