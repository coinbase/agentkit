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
  - Returns the requestId, the route, the amounts, the third-party costs, the notices and the checked unsigned calls
  - Does not send any transactions
  - Keeps the checked plan in memory, for one execute_swap, until its `validUntil` (about a minute)

- `execute_swap`: Send a plan that `plan_swap` returned
  - Takes the plan's `requestId` and `confirmed: true`, to be set only after the user has confirmed the plan
  - Sends exactly that plan's calls, in order, and waits for each one; it does not plan again
  - Runs a plan only once, only before its `validUntil`, and only from the wallet address and chain it was made for; otherwise the swap must be planned again
  - Checks the wallet's address and chain again before every call
  - Needs `sellToken` and `buyToken` given as contract addresses, or as USDC or the chain's native or wrapped native coin
  - For a sell token other than those, reads its `decimals()` from the chain through the wallet provider and needs the approve to be for exactly the requested amount
  - Records each hash as soon as it is sent: `txHash`, or `userOpHash` on smart wallets with the mined `txHash` once the wallet reports it
  - If a send or a receipt wait throws, returns `outcome_unknown` with every hash sent. For a smart wallet it first waits for the user operation once more, and the instruction is to check the wallet's user operation before any retry; otherwise it is to track the swap with `track_swap`

- `track_swap`: Report the status of a sent swap (by chain and transaction hash) or gas top-up (by requestId)

- `quote_gas`: Quote native gas (ETH, BNB or POL) paid in USDC from the wallet
  - Does not sign anything

- `buy_gas`: Buy native gas with USDC
  - Requires `confirmed: true`, to be set only after the user has confirmed the quote
  - Gets a fresh offer, checks it, signs its single USDC authorization with the wallet and submits it
  - Checks the wallet's address and chain again before signing
  - Needs a wallet that signs with its own key; smart wallet providers and smart contract wallets are refused, EIP-7702 delegated accounts are not

## Checks

Before a plan or gas offer is returned, it goes through the address checks of [`@cleave-protocol/ai-sdk/core`](https://www.npmjs.com/package/@cleave-protocol/ai-sdk).

- For swaps: every call is from the wallet on its chain. The last call goes to a contract and function on Cleave's published list that fits the route, and pays the recipient where its calldata names one. Any earlier call only approves the sell token to that contract for exactly what the last call pulls. For USDC and the native or wrapped native coin, the amount sold is also checked against the request.
- For gas: the authorization is a USDC `ReceiveWithAuthorization` from the wallet. The order carries the requested amount and recipient, the pinned contracts and the fee and minimum the offer shows. The order hash and the payment address are recomputed.

A plan or offer that fails a check is refused and nothing is sent or signed.

The checks do not cover the price or the amount received. Have a person confirm each swap and gas top-up.

## Responses

Every response passed to the model has URLs removed. The API's instruction text (`next`) is dropped, and the gas authorization signature is never included.

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
