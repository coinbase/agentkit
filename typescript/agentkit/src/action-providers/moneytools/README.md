# MoneyTools Action Provider

Read-only onchain safety checks from [MoneyTools](https://tools.moneytools.dev/agents.md), paid per call over [x402](https://www.x402.org/) in USDC on Base. Useful right before an agent pays a counterparty or buys a token.

## Actions

| Action | Description | Price |
|---|---|---|
| `wallet_risk_card` | 0-100 risk score, A-F grade, OFAC SDN match, address checks (contract, EIP-7702 delegation), open ERC-20 approvals summary | 0.02 USDC |
| `token_safety_check` | USDC -> token -> USDC round-trip simulation with live DEX quotes plus owner / proxy / paused flags (honeypot, sell tax) | free tier, then 0.005 USDC |
| `token_contract_info` | ERC-20 name, symbol, decimals, supply, owner, paused, upgradeable proxy | free tier, then 0.005 USDC |

Chains read: base, ethereum, arbitrum, optimism, polygon, bsc, avalanche.

## Setup

```typescript
import { AgentKit, moneytoolsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [moneytoolsActionProvider({ maxPaymentUsdc: 0.02 })],
});
```

## Payment safety

- The provider first makes an unpaid request. Token checks use the free daily tier when available.
- It signs an x402 payment only if the wallet is an EVM wallet on `base-mainnet`, the quote is USDC on Base (`eip155:8453`), and the price is at or below `maxPaymentUsdc` (default 0.02). Otherwise it returns the terms with `paymentRequired: true`.
- Paid responses include `operation_id` and a free `result_url` (7 days). The API does not charge twice for the same signed payment, and failed calls are not charged.
