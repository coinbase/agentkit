# Floe Working Capital Provider

Financial independence is the precursor to agent autonomy. Long-running agents can't do anything meaningful without their own fundable balance sheet. Floe gives them one.

**3,000+ secured working capital lines issued. Zero defaults.**

Deposit USDC, borrow up to 95% as a credit line. Fixed rates, per-loan isolated escrow, gas-free. Fund with a bank account or card — no crypto experience needed.

## Actions

| Action | Type | Description |
|--------|------|-------------|
| `getMarkets` | Read | List available lending markets |
| `instantBorrow` | Write | Deposit USDC, borrow up to 95% working capital — auto-selects best lender |
| `repay` | Write | Repay a loan (deposit returns automatically) |
| `checkStatus` | Read | Loan health, balance, accrued interest, time to expiry |
| `getBalance` | Read | Credit balance for facilitator-delegated agents |
| `checkHealth` | Read | On-chain LTV and liquidation risk |
| `grantDelegation` | Write | Delegate credit to Floe facilitator for gas-free x402 payments (one-time) |
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

// Use with Vercel AI SDK, LangChain, or any framework
const tools = getVercelAITools(agentkit);
```

## Why agents need credit

100M+ x402 machine payments since May 2025. 100,000+ agents with onchain identity. Zero credit outstanding to any of them.

Every economy runs on credit. Agents don't have FICO — but they have something better: deterministic cashflows and verifiable execution history. Floe is the credit bureau and capital rail for AI agents.

## Network

- **Base Mainnet** — Coinbase's L2, built for payments
- **Contract:** [`0x17946cD3e180f82e632805e5549EC913330Bb175`](https://basescan.org/address/0x17946cD3e180f82e632805e5549EC913330Bb175)

## Links

- [Docs](https://floe-labs.gitbook.io/docs)
- [Bank Account → First API Call](https://floe-labs.gitbook.io/docs/agents/fiat-to-x402) — fund with fiat, no crypto needed
- [Full npm package (45 actions)](https://www.npmjs.com/package/floe-agent)
- [Dashboard](https://dev-dashboard.floelabs.xyz)
- [Website](https://floelabs.xyz)
