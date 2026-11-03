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
  - A smart contract wallet must name the recipient for a swap to another chain
  - Returns the route, the amounts, the third-party costs, the notices and the unsigned calls
  - Does not send any transactions

- `execute_swap`: Execute a swap from the wallet on its current chain
  - Requires `confirmed: true`, to be set only after the user has confirmed the plan
  - Takes an optional `minimumReceive`: `receive.minimum` from the plan the user confirmed; the swap is refused when the new plan's minimum is lower
  - Plans again, runs the checks below, then sends the calls in order and waits for each one
  - Sends nothing if a check fails, the plan is blocked or it has expired
  - Records each hash as soon as it is sent (`userOpHash` on smart wallets, with the mined `txHash` once known); if a send or a receipt wait throws, it returns `outcome_unknown` with every hash sent, to be tracked before any retry
  - Returns the hashes and the requestId

- `track_swap`: Report the status of a sent swap or gas top-up

- `quote_gas`: Quote native gas (ETH, BNB or POL) paid in USDC from the wallet
  - Does not sign anything

- `buy_gas`: Buy native gas with USDC
  - Requires `confirmed: true`, to be set only after the user has confirmed the quote
  - Gets a fresh offer, checks it, signs its single USDC authorization with the wallet and submits it
  - Needs a wallet that signs with its own key; smart contract wallets are refused

## Checks

Before the wallet sends or signs anything, every plan and gas offer goes through the address checks of [`@cleave-protocol/ai-sdk/core`](https://www.npmjs.com/package/@cleave-protocol/ai-sdk).

- For swaps: every call is from the wallet on its chain. The last call goes to a contract and function on Cleave's published list that fits the route, and pays the recipient where its calldata names one. Any earlier call only approves the sell token to that contract for exactly what the last call pulls. For USDC and the native or wrapped native coin, the amount sold is also checked against the request.
- For gas: the authorization is a USDC `ReceiveWithAuthorization` from the wallet. The order carries the requested amount and recipient, the pinned contracts and the fee and minimum the offer shows. The order hash and the payment address are recomputed.

A plan or offer that fails a check is refused and nothing is sent or signed.

What the checks do not cover:

- The price and the amount received
- For sell tokens other than USDC and the native or wrapped native coin, the amount sold against the request: show the user `send.amount` and `pullsAtMost`
- When `sellToken` is a symbol other than those, which token the API resolved it to: show the user `send.token`

Have a person confirm each swap and gas top-up.

## Network Support

The provider supports Ethereum (1), Optimism (10), BNB Chain (56), Polygon (137), Base (8453) and Arbitrum (42161). Gas top-ups are paid from Ethereum, Optimism, Polygon, Base or Arbitrum; on BNB Chain, `quote_gas` and `buy_gas` refuse.

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
