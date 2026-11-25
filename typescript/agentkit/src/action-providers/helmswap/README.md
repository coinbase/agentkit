# HelmSwap Action Provider

This directory contains the **HelmswapActionProvider** implementation, which quotes and executes token swaps on EVM networks using the public [HelmSwap](https://helmswap.com) API ([OpenAPI spec](https://helmswap.com/openapi.json)).

## Overview

HelmSwap returns a quote and an **unsigned** transaction. The provider signs and sends it with the agent's own `EvmWalletProvider`. The provider never handles private keys, and the HelmSwap API never signs or broadcasts. A disclosed fee is included in each quote, and the quote response shows the fee amount and the minimum output before you swap. No API key is required.

## Directory Structure

```
helmswap/
├── helmswapActionProvider.ts       # Main provider implementation
├── helmswapActionProvider.test.ts  # Test suite
├── schemas.ts                      # Action schemas
├── index.ts                        # Package exports
└── README.md                       # Documentation (this file)
```

## Actions

- `get_swap_quote_from_helmswap`: fetches a quote with the expected output, minimum output after slippage, price impact and disclosed fee. Nothing is executed.
- `execute_swap_on_helmswap`: fetches a quote, asks HelmSwap to build the swap with the wallet as recipient, then sends any exact-amount ERC-20 approval followed by the swap transaction. The swap is not built when the quote reports the price impact as too high.

Both actions take:

- `sellToken`: token address to sell (`0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for the native asset)
- `buyToken`: token address to buy
- `sellAmount`: amount in whole units (e.g. `"0.01"`)
- `slippageBps`: optional, default 50, max 1000

## Usage

```typescript
import { AgentKit, helmswapActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [helmswapActionProvider()],
});
```

## Network Support

EVM chain ids 1, 56, 999, 4663, 5042, 8453, 57073 and 99901.

## Notes

- Quote tickets are short-lived. If a build fails with a 409, request a new quote and try again.
- The API is rate limited per IP. A 429 response includes `Retry-After`.
