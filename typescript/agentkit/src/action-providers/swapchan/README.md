# SwapChan Action Provider

This directory contains the **SwapChanActionProvider**, which gets quotes from and executes swaps through [SwapChan](https://swapchan.com). SwapChan is a keyless meta-aggregator: it queries LI.FI, Relay, 0x, deBridge, THORChain, Jupiter and others and ranks the routes by net output.

## Directory Structure

```
swapchan/
├── swapchanActionProvider.ts        # Main provider
├── swapchanActionProvider.test.ts   # Tests
├── schemas.ts                       # Action schemas
├── index.ts                         # Main exports
└── README.md                        # This file
```

## Actions

- `get_swap_quote_from_swapchan`: returns up to 5 ranked routes for a same-chain swap or a cross-chain bridge. Read-only.
- `execute_swap_on_swapchan`: picks the best route that can be executed with a plain transaction. If an ERC20 allowance is needed, it sends the approval first, then sends the swap. It returns the transaction hashes and a status URL. Routes that need off-chain order or Permit2 signatures are skipped.

## Network Support

The provider runs on any EVM network that SwapChan supports (Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche, Linea, Scroll). Destinations can also be Solana (`792703809`), Bitcoin (`8253038`) or Tron (`728126428`); for those, set `toAddress`.

## Configuration

No API key is required.

```typescript
const provider = swapchanActionProvider({
  partnerId: "your-partner-id", // optional, for fee attribution
});
```

You can also set the partner id with the `SWAPCHAN_PARTNER_ID` environment variable.

## Notes

- The address for native ETH or the native gas token is `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`.
- Amounts are given in whole units (e.g. `"1.5"`), not wei.
- Slippage defaults to 50 bps.
