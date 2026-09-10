# Graph Advocate Action Provider

This directory provides an action provider for [Graph Advocate](https://graphadvocate.com), giving an AgentKit agent paid access to agent-priced onchain-intelligence endpoints. Each action calls a Graph Advocate endpoint gated by x402; the agent's own wallet auto-pays a small USDC fee on Base, and the action returns the JSON result.

Use it when an agent needs to **vet a counterparty wallet or agent** before trusting, paying, following, mirroring a copy-trade, or transacting.

## Actions

| Action | What it returns | Price (USDC on Base) |
|---|---|---|
| `get_hyperliquid_trader_score` | Hyperliquid perps trading skill (0-100): win rate, Sharpe-like return, liquidation rate, funding burn, classification | ~$0.02 |
| `get_polymarket_trader_score` | Polymarket trading skill (0-100): Sharpe-weighted score, win rate, sample size, PnL | ~$0.01 |
| `get_agent_reputation` | Onchain reputation (0-100) from ERC-8004 identity + USDC settlement velocity + recency | ~$0.02 |

All take `{ "wallet": "0x..." }`.

## Wallet Providers

Requires an `EvmWalletProvider` (payments settle in USDC on Base). The provider signs x402 payments exactly the way AgentKit's built-in `x402` provider does (`x402Client` + `wrapFetchWithPayment` + `registerExactEvmScheme`).

## Network Support

Base mainnet only (that is where the x402 payments settle).

## Configuration

```typescript
import { graphAdvocateActionProvider } from "@coinbase/agentkit";

const provider = graphAdvocateActionProvider({
  // Per-call spend ceiling in whole USDC. An action priced above this is
  // refused before any payment is signed. Defaults to
  // GRAPH_ADVOCATE_MAX_PAYMENT_USDC env var, then 1.0.
  maxPaymentUsdc: 0.10,
  // Optional: override the base URL (e.g. a self-hosted instance).
  // baseUrl: "https://graphadvocate.com",
});
```

## Example

```typescript
const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [graphAdvocateActionProvider({ maxPaymentUsdc: 0.10 })],
});
```

Then the agent can, on its own:

```
User: Before I mirror 0x38e5…8a4a on Hyperliquid, is this a sharp trader?
Agent: (calls get_hyperliquid_trader_score) skill_score 71.4, classification "sharp",
       win_rate 0.61, sharpe_like 0.84 — paid $0.02 USDC on Base.
```

## Notes

- Payment only settles on a `200`. Non-200 responses return `success: false` and do **not** charge.
- The per-call price is checked against `maxPaymentUsdc` before any signature, so a misconfiguration cannot overspend.
