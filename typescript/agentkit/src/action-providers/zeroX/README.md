# 0x Action Provider

This directory contains the **ZeroXActionProvider** implementation, which provides actions to interact with the **0x Protocol** for token swaps on EVM-compatible networks.

## Directory Structure

```
zeroX/
├── zeroXActionProvider.ts        # Main provider with 0x Protocol functionality
├── zeroXActionProvider.test.ts   # Tests
├── schemas.ts                    # Swap schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `get_swap_price_quote_from_0x`: Get a price quote for swapping tokens
  - Returns detailed price information including exchange rate, fees, and minimum buy amount
  - Does not execute any transactions
  - Supports optional affiliate fee collection

- `execute_swap_on_0x`: Execute a token swap between two tokens
  - Handles token approvals automatically if needed
  - Executes the swap transaction
  - Returns the transaction hash and swap details upon success
  - Supports optional affiliate fee collection

## Adding New Actions

To add new 0x Protocol actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `zeroXActionProvider.ts`
3. Add tests in `zeroXActionProvider.test.ts`

## Network Support

The 0x provider supports all EVM-compatible networks where the 0x API is available.

## Configuration

The provider requires the following configuration:

```typescript
const provider = zeroXActionProvider({
  apiKey: "your-0x-api-key" // Required for 0x API access
});
```

You can also set the API key via environment variable:

```
ZEROX_API_KEY=your-0x-api-key
```

## Notes

- The contract address for native ETH is `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
- All token amounts should be specified in whole units (e.g., "1.5" ETH, not wei)
- Slippage setting is optional and defaults to 1% (100 basis points) if not specified
- Always check price quotes before executing swaps to ensure favorable rates
- For affiliate fees: provide swapFeeRecipient to enable fees (swapFeeBps defaults to 1%)
- Affiliate fees are automatically collected from the sellToken and sent to the specified recipient address

For more information on the **0x Protocol**, visit [0x Protocol Documentation](https://docs.0x.org/). 