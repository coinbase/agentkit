# SelfPaid Action Provider

This directory contains the **SelfPaidActionProvider** ([SelfPaidPal](https://selfpaid.cryptofolio.it)), enabling autonomous AI agents on **Base Mainnet (Chain ID 8453)** to execute **zero-net-cost USDC payments, bounties, and tips** where **100% of the principal is automatically recouped** through DeFi yield farming on **Aave V3** and **Morpho**.

## Directory Structure

```
selfpaid/
├── selfPaidActionProvider.ts      # Main provider with 6 zero-cost payment & treasury actions
├── selfPaidActionProvider.test.ts # Unit tests
├── constants.ts                   # Endpoint, protocols, and supported networks
├── schemas.ts                     # Zod input schemas and config type
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `check_yield_rates`: Fetch live USDC lending APYs on Base Mainnet for Aave V3 and Morpho Vaults and estimate 100% recovery speeds.
- `quote_zero_cost_payment`: Calculate the required yield collateral deposit, developer fee (0.5%, min 0.10 USDC), and estimated recovery duration for a zero-net-cost USDC payment.
- `prepare_zero_cost_payment`: Prepare a 4-call atomic zero-cost payment batch on Base and export a **Safe Transaction Builder JSON** payload for DAO multisigs without broadcasting.
- `send_zero_cost_payment`: Autonomous on-chain execution on Base Mainnet — pays the recipient, transfers the maintenance fee, optimizes ERC-20 allowance, and deposits yield collateral into Aave V3 or Morpho.
- `get_treasury_status`: Check active yield-bearing collateral (`aBasUSDC` / `maUSDC`), liquid USDC, and accrued yield interest for an agent wallet on Base.
- `redeem_collateral`: Withdraw yield-bearing collateral (`aBasUSDC` or `maUSDC`) back to liquid USDC with **Zero Lockup** (`execute: true` to broadcast on-chain, `false` to inspect calldata).

## Configuration

```typescript
import { AgentKit, selfPaidActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // Base Mainnet EVM wallet provider
  actionProviders: [selfPaidActionProvider()],
});
```

## Network Support

TheSelfPaidActionProvider operates on `base-mainnet` (Chain ID `8453`).
