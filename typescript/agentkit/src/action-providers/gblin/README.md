# GBLIN Action Provider

Actions for interacting with [GBLIN](https://gblin.digital), a collateral-backed,
self-defending treasury index on Base (WETH / cbBTC / USDC) with an autonomous
on-chain "Crash Shield" that reduces risk during drawdowns. It is intended for
parking surplus agent capital with capped drawdown — managed crypto exposure,
**not** a stablecoin and not financial advice.

Contract (verified): [`0x36C81d7E1966310F305eA637e761Cf77F90852f0`](https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0#code)

## Actions

| Action | Description |
| --- | --- |
| `buy_gblin` | Buy GBLIN with ETH. Reads `quoteBuyGBLIN` on-chain and submits `buyGBLIN` with a slippage-bounded minimum output. |
| `sell_gblin_for_eth` | Redeem GBLIN back to ETH (e.g. to fund an x402 payment). Reads `quoteSellGBLIN` and submits `sellGBLINForEth` with a min-out. |
| `get_gblin_state` | Read per-GBLIN ETH redemption value and total supply. |

Every state-changing action derives its minimum output from the contract's own
quote function, so the agent is never exposed to an unbounded swap.

## Network support

Base mainnet (`base-mainnet`) only.

## Example

```typescript
import { gblinActionProvider } from "@coinbase/agentkit";

const provider = gblinActionProvider();
```

## Notes

- GBLIN enforces a short post-purchase cooldown before redemption.
- The risk policy is public code governed by a 48h timelock, and has executed
  autonomously on mainnet ([activation tx](https://basescan.org/tx/0x896be221989930776972c78f81e2be9081c90d0027c14f7cd74bf51b9ad0acca)).
