# Pre-Trade Stack Action Provider

This directory contains the **PreTradeStackActionProvider** implementation, which gives AI agents three native pre-trade actions against StallRow, a live [x402](https://x402.org) service:

- `pre_trade_guard` (**$0.005 USDC per call on Base**): screen a payTo BEFORE paying it — Verdict Index catalog history (first seen, payTo rotations), an OFAC sanctions exact-match check, and the wallet's Base age/activity, combined into **PROCEED / CAUTION / ABORT** with itemized reasons.
- `counterparty_report` (**$1.00 USDC per call on Base**): the full multi-leg dossier on a seller before a larger commitment.
- `receipt_verify` (**$0.002 USDC per call on Base**): verify that a Base transaction really paid the claimed payTo and amount.

Each action is paid automatically from the agent's own wallet provider, with a spend guard pinned to its known price — no accounts, no API keys.

## Directory Structure

```
preTradeStack/
├── preTradeStackActionProvider.ts       # Main provider with the three actions
├── preTradeStackActionProvider.test.ts  # Test file for the Pre-Trade Stack provider
├── schemas.ts                           # Action schemas (the service's request contracts)
├── constants.ts                         # Service URL, prices, and network constants
├── utils.ts                             # x402 paying fetch + spend-guard policy
├── index.ts                             # Main exports
└── README.md                            # This file
```

## Actions

- `pre_trade_guard`: Screens a payTo before paying it (PROCEED / CAUTION / ABORT)
- `counterparty_report`: Builds a full counterparty report on a seller
- `receipt_verify`: Verifies a Base payment receipt on-chain

## Setup

To use the Pre-Trade Stack action provider:

```typescript
import { preTradeStackActionProvider } from "@coinbase/agentkit";

const provider = preTradeStackActionProvider();

// Or with overrides (e.g. a different service deployment or price guard)
const providerWithOptions = preTradeStackActionProvider({
  baseUrl: "https://stall-row-production.up.railway.app", // default
  maxAmountPerPayment: "$1.00", // spend guard override; defaults to each action's known price
});
```

The wallet provider must be an EVM wallet on Base mainnet — payments settle in USDC on Base.
