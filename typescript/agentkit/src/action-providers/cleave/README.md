# Cleave Action Provider

This directory contains the **CleaveActionProvider** implementation, which provides actions to swap tokens with **Cleave**, a DEX aggregator by Cleave Protocol, on one chain or between Ethereum, Arbitrum, Base, BNB Chain, Polygon and Optimism, and to buy native gas with USDC.

## Directory Structure

```
cleave/
├── cleaveActionProvider.ts        # Main provider with Cleave functionality
├── cleaveActionProvider.test.ts   # Tests
├── schemas.ts                     # Action schemas
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `find_token`: Find a token by symbol or contract address
  - Returns its address, decimals and whether it is on Cleave's token list
  - A symbol shared by several listed tokens returns up to ten candidates

- `plan_swap`: Plan a swap from the wallet on its current chain
  - The token to receive can be on the same chain or on another supported chain
  - Returns the route, the amounts, the third-party costs, the notices and the unsigned calls
  - Does not send any transactions

- `execute_swap`: Execute a swap from the wallet on its current chain
  - Requires `confirmed: true`, to be set only after the user has confirmed the plan
  - Plans again, checks every call, then sends the calls in order and waits for each one
  - Sends nothing if a check fails, the plan is blocked or it has expired
  - Returns the transaction hashes and the requestId

- `track_swap`: Report the status of a sent swap or gas top-up

- `quote_gas`: Quote native gas (ETH, BNB or POL) paid in USDC from the wallet
  - Does not sign anything

- `buy_gas`: Buy native gas with USDC
  - Requires `confirmed: true`, to be set only after the user has confirmed the quote
  - Gets a fresh offer, checks it, signs its single USDC authorization with the wallet and submits it
  - Needs a wallet that signs with its own key; smart contract wallets are refused

## Checks

Before the wallet sends or signs anything, every plan and gas offer goes through the address checks of [`@cleave-protocol/ai-sdk/core`](https://www.npmjs.com/package/@cleave-protocol/ai-sdk).

- For swaps, the checks cover the contracts and functions called, the approve spender and amount, the sell token and amount, the wallet, the chain and the recipient.
- For gas, they cover the order hash, the payment address and the pinned contracts.

A plan or offer that fails a check is refused and nothing is sent or signed.

The checks do not cover the price or the amount received. Have a person confirm each swap and gas top-up.

## Network Support

The provider supports Ethereum (1), Optimism (10), BNB Chain (56), Polygon (137), Base (8453) and Arbitrum (42161). Gas top-ups are paid from Ethereum, Optimism, Polygon, Base or Arbitrum.

## Configuration

No API key is needed:

```typescript
const provider = cleaveActionProvider();
```

Optional settings:

```typescript
const provider = cleaveActionProvider({
  apiKey: "your-partner-key", // Optional; also read from CLEAVE_API_KEY
  baseUrl: "https://api.cleave.fi",
  timeoutMs: 30000,
});
```

## Notes

- Amounts are in whole token units, such as "25.5"
- Slippage defaults to 50 basis points
- Cleave's fee is included in the price; third-party costs are listed in each plan
- The wallet's address and current chain are the payer and the source chain; the model does not choose them

For more information, visit the [Cleave agent docs](https://cleave.fi/docs/agents).
