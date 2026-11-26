# TaxRail Action Provider

This directory contains the **TaxRail** action provider (`taxrailActionProvider`) for pre-execution US (IRS 1099-DA, Form 8949, SpecID/HIFO, Tax-Loss Harvesting, Aave v3 Borrow-vs-Sell) and Brazil (Lei 14.754, R$35k rule, Lucro Real) tax optimization before executing on-chain swaps or liquidations.

## Actions

- `check_tax_impact`: Free Step-1 pre-trade disposal simulation comparing naive FIFO vs HIFO/SpecID and returning an unlockable `planId`.
- `compare_borrow_vs_sell`: Free simulation comparing capital gains tax from selling vs borrowing USDC on Aave v3.
- `classify_deductible_expense`: Free corporate expense tax-shield classification (US LLC/C-Corp & Brazil Lucro Real).
- `check_br_35k_status`: $0.005 USDC x402 check for Brazil R$35k monthly domestic exemption vs Lei 14.754 15% flat rate.

## Usage

```typescript
import { AgentKit, taxrailActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    taxrailActionProvider({
      referrerWallet: "0xYourAgentBaseWallet", // Optional: earn 20% affiliate revshare
    }),
  ],
});
```
