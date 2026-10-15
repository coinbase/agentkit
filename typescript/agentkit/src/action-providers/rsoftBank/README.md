# RSoft Bank Action Provider

This directory contains the **RsoftBankActionProvider** implementation, which
provides actions to interact with [RSoft Agentic Bank](https://rsoft-agentic-bank.com/) —
an AI-native USDC lending service for autonomous agents, live on **Base mainnet**.

Agents can check their creditworthiness, vet counterparties with on-chain trust
scores, request real USDC loans signed with their own wallet, and confirm
repayments — building a portable **ERC-8004 on-chain credit reputation** with
every repaid loan.

## Directory Structure

```
rsoftBank/
├── rsoftBankActionProvider.ts         # Main provider with bank actions
├── rsoftBankActionProvider.test.ts    # Tests
├── constants.ts                       # URLs and EIP-712 domain/types
├── schemas.ts                         # Action schemas
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `get_interest_rates`: Current USDC lending rates and terms by risk tier (free, no key)
- `get_creditworthiness`: Credit score, loan history and outstanding debt of an agent (free)
- `get_trust_score`: AgentTrust-8004 trust score (0-100) of any agent wallet, with anomaly flag (free)
- `request_loan`: Request a real USDC loan — signs the bank's EIP-712 `LoanRequest`
  struct with the agent's own wallet via `walletProvider.signTypedData` and submits
  it. Requires a bank API key (fail-closed without one)
- `get_repayment_info`: Amount owed, treasury address, USDC contract and request id (free)
- `confirm_repayment`: Report the on-chain USDC transfer hash so the bank verifies
  it on Base and marks the loan repaid

## Setup

```typescript
import { rsoftBankActionProvider } from "@coinbase/agentkit";

const provider = rsoftBankActionProvider({
  apiKey: process.env.RSOFT_BANK_API_KEY, // required only for request_loan
});
```

## Notes

- **Network support**: Base mainnet only (`base-mainnet` / chain id 8453).
- **Real money**: loans are real USDC with on-chain consequences; defaults are
  recorded against the agent's reputation. Loans start at the $5 floor and grow
  along a credit ladder with each successful repayment.
- The bank never sees a private key: the wallet signs, the provider transports.
- Repayment uses the standard `erc20` transfer action; this provider then
  confirms the tx hash with the bank.
- Docs: [rsoft-agentic-bank.com/docs](https://rsoft-agentic-bank.com/docs)
