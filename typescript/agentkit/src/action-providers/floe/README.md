# Floe — The Financial OS for AI Agents

Wallet, fiat on/off-ramp, working capital, x402 payments, and portable credit — in one action provider.

**3,000+ secured working capital lines issued. Zero defaults. 13,000+ x402 APIs reachable.**

## The financial loop

```
1. Fund     → Buy USDC with a bank account or card (dashboard)
2. Deposit  → Agent deposits USDC as collateral
3. Borrow   → Get up to 95% back as working capital (instant_borrow)
4. Spend    → Call any x402 API — Floe pays automatically (x402_fetch)
5. Repay    → Pay back principal + fixed fee, deposit returns
6. Trust    → Every repayment builds the agent's credit record
```

No price-volatility risk. No crypto complexity. Gas-free for delegated agents.

## Actions

| Action | Type | What it does |
|--------|------|--------------|
| `getMarkets` | Read | Available lending markets and terms |
| `instantBorrow` | Write | Deposit USDC, borrow up to 95% — auto-selects best lender |
| `repay` | Write | Repay loan — deposit returns automatically |
| `checkStatus` | Read | Loan health, balance, accrued interest, time to expiry |
| `getBalance` | Read | Credit balance + utilization (for facilitator-delegated agents) |
| `checkHealth` | Read | Current LTV and liquidation risk |
| `grantDelegation` | Write | Delegate to Floe facilitator for gas-free x402 payments (one-time) |
| `x402Fetch` | Write | Call any x402 API — Floe handles payment automatically |

## Setup

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { FloeActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [new FloeActionProvider()],
});

const tools = getVercelAITools(agentkit);
```

## Why

100M+ x402 machine payments since May 2025. 100,000+ agents with onchain identity. Zero credit outstanding to any of them.

Every economy runs on credit. Agents don't have FICO — but they have something better: deterministic cashflows and verifiable execution history. Floe is building the credit bureau and capital rail for all AI agents.

## Network

- **Base Mainnet** — Coinbase's L2, built for payments
- **Contract:** [`0x17946cD3e180f82e632805e5549EC913330Bb175`](https://basescan.org/address/0x17946cD3e180f82e632805e5549EC913330Bb175)

## Links

- [Quickstart](https://floe-labs.gitbook.io/docs/getting-started/quickstart) — from zero to first API call
- [Full npm package (45 actions)](https://www.npmjs.com/package/floe-agent)
- [Dashboard](https://dev-dashboard.floelabs.xyz) — fund with fiat, manage agents
- [Docs](https://floe-labs.gitbook.io/docs)
- [Website](https://floelabs.xyz)
