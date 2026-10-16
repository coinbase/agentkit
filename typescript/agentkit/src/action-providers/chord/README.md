# Chord Action Provider

This directory contains the **ChordActionProvider** implementation, which provides actions to quote and execute token swaps through [Chord](https://getchord.xyz), a DEX aggregator that splits an order across venues when that gives a better output and settles it through one router contract.

## Directory Structure

```
chord/
├── chordActionProvider.ts         # Main provider with the Chord actions
├── chordActionProvider.test.ts    # Tests
├── api.ts                         # Chord REST API client
├── constants.ts                   # Router address, supported chains, defaults
├── schemas.ts                     # Action schemas
├── utils.ts                       # Token resolution and quote formatting
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `search_tokens`: Searches Chord's token index on the wallet's chain by symbol, name or address
  - Returns address, symbol, name, decimals and whether the token is on the chain's curated list
- `get_swap_quote`: Fetches the best route for a swap without sending anything
  - Returns the expected output, the minimum the transaction enforces, price impact, Chord's fee and the venues used
- `swap`: Swaps tokens through the Chord router
  - Approves the router for exactly the input amount when the allowance is too low
  - Builds the transaction with the Chord API and refuses it unless it targets the Chord router on the wallet's chain
  - Simulates it from the wallet and only then sends it
  - Returns the transaction hash and, for an ERC-20 output, the amount received

Transactions are built unsigned by the API and signed by the agent's wallet provider. Chord never takes custody of keys or funds.

## Network Support

The provider is active when the wallet is on one of these chains (the router is deployed at `0x1b1fee89a381e595fe6536b99ba91f3e16e9601a` on each):

- **Ethereum**: Chain ID 1
- **BNB Chain**: Chain ID 56
- **Monad**: Chain ID 143
- **Robinhood Chain**: Chain ID 4663
- **Arc**: Chain ID 5042
- **Base**: Chain ID 8453
- **Arbitrum One**: Chain ID 42161
- **Avalanche C-Chain**: Chain ID 43114

## Configuration

No configuration is required. Quotes and swaps work without an API key at the public limit of 60 requests per minute per IP.

```typescript
const provider = chordActionProvider({
  apiKey: "your-chord-api-key", // Optional, sent as X-API-Key
  baseUrl: "https://api.getchord.xyz/v1", // Optional
});
```

The API key can also be set with the `CHORD_API_KEY` environment variable.

## Notes

- Amounts are given in whole units (`"1.5"` ETH, `"10"` USDC); the provider reads decimals on-chain
- The native coin is `0x0000000000000000000000000000000000000000`; `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` is accepted too
- On Arc gas is paid in USDC; the provider sends the USDC system contract (`0x3600000000000000000000000000000000000000`, 6 decimals) for the native coin, so an Arc native input is approved and pulled like an ERC-20
- USDT on Ethereum rejects a new approval while an allowance is still open; the provider resets it to zero first
- Chord's fee is read on-chain per output token; the quote reports it as `feeBps` and `feeAmount`, and the expected output is already net of it
- Slippage defaults to 50 basis points (0.5%)

For more information, see the [Chord documentation](https://getchord.xyz/docs).
