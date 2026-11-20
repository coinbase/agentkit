# Kestrova Action Provider

This directory contains the **KestrovaActionProvider**, which lets an agent check Solidity smart contracts for known
vulnerability patterns with [Kestrova](https://kestrova-api.onrender.com) (Slither static analysis) before it deploys
them. The preview is free; full results are paid per call with x402 in USDC on Base or Solana mainnet.

Kestrova is automated static analysis, not an audit: zero findings does not mean a contract is safe.

## Directory Structure

```
kestrova/
├── constants.ts                     # Service URL, tiers and the only payment terms that may be signed
├── kestrovaActionProvider.test.ts   # Tests for the provider
├── kestrovaActionProvider.ts        # Main provider
├── index.ts                         # Main exports
├── README.md                        # Documentation
└── schemas.ts                       # Action schemas and configuration
```

## Configuration

```typescript
import { kestrovaActionProvider } from "@coinbase/agentkit";

const provider = kestrovaActionProvider({
  maxPaymentUsdc: 1.0, // default 1.0 (or KESTROVA_MAX_PAYMENT_USDC)
});
```

## Actions

- `kestrova_scan_preview` (free, no wallet): severity counts, High/Medium detector names, one example finding and
  `behind_paywall` (exactly what a paid result would add for this code).
- `kestrova_get_scan_price` (free): live price of a tier for the wallet's network, checked against Kestrova's
  published terms. Show it to the user before buying.
- `kestrova_buy_scan` (paid, x402):
  - `findings` (0.25 USDC): every finding with detector, severity, confidence, file/line locations and Slither's
    description, as JSON.
  - `full` (1 USDC): adds a plain-English explanation and fix per finding, plus PDF and SARIF report files.

## Payment safety

- The x402 client gets a payment policy that keeps only Kestrova's exact published terms: scheme `exact`, USDC, the
  published recipient and network, and the tier's amount. Anything else is never signed.
- `maxPaymentUsdc` caps every call.
- Charged only if the scan succeeds. If a payment was made but the outcome is unclear, the action returns
  `doNotPayAgain: true`: recover the paid report for free with a wallet signature (`POST /scan/recover`), never by paying
  again.

## Network Support

The preview works on any network. Paid scans need an EVM wallet on `base-mainnet` or an SVM wallet on
`solana-mainnet`.
