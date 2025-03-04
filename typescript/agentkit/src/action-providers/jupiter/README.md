# Jupiter Action Provider

This directory contains the **JupiterActionProvider** implementation, which provides actions to interact with the **Jupiter DEX Aggregator** for token swaps.

## Directory Structure

```
jupiter/
├── jupiterActionProvider.ts    # Main provider with Jupiter swap functionality
├── schemas.ts                  # Swap token action schemas
├── index.ts                    # Main exports
└── README.md                   # This file
```

## Actions

### Jupiter Swap Action
- `swap`: Swap SPL tokens using **Jupiter DEX**
  - Fetches the best available swap route using **Jupiter's API**
  - Constructs and signs the swap transaction
  - Ensures sufficient token balance before execution
  - Supports automatic **SOL wrapping/unwrapping** for native SOL swaps
  - Returns the **transaction signature** upon success

## Adding New Actions

To add new Jupiter actions:

1. Define the schema in `schemas.ts`
2. Implement the action in `jupiterActionProvider.ts`
3. Ensure proper **error handling and logging**

## Network Support
The Jupiter Action Provider currently supports:
- **Solana Mainnet** (`solana-mainnet`)

## Notes
- The swap operation **automatically wraps and unwraps SOL** when needed.
- Ensure **valid token mint addresses** are used.
- Transactions are **signed and executed automatically** within the provider.

For more information on the **Jupiter DEX API**, visit [Jupiter Aggregator Docs](https://api.jup.ag/).

