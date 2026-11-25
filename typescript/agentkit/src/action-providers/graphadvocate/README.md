# Graph Advocate Action Provider

This directory provides an action provider for [Graph Advocate](https://graphadvocate.com). Agents can start with a **free** live preview, then pay a small USDC fee on Base over x402 for full `/route` answers, trader scores, and reputation scores. Paid actions auto-pay from the agent's own wallet using the same x402 signing stack as AgentKit's built-in `x402` provider (`x402Client` + `wrapFetchWithPayment` + `registerExactEvmScheme`).

Use `get_preview` / `route` when an agent needs live onchain data (Uniswap, Aave, Compound, ENS, Polymarket, and 15.5K+ subgraphs). Use the score actions when it needs to **vet a counterparty wallet or agent** before trusting, paying, following, mirroring a copy-trade, or transacting.

## Actions

| Action | What it returns | Price (USDC on Base) |
|---|---|---|
| `get_preview` | Free live top-3 rows for a plain-English question (`GET /preview?q=`). No wallet required. | Free |
| `route` | Full answer: formatted `result` rows, `query_ready` (the working GraphQL/REST query), and `executed` gateway data (`POST /route`) | $0.01 |
| `get_hyperliquid_trader_score` | Hyperliquid perps trading skill (0-100): win rate, Sharpe-like return, liquidation rate, funding burn, classification | $0.02 |
| `get_polymarket_trader_score` | Polymarket trading skill (0-100): Sharpe-weighted score, win rate, sample size, PnL | $0.01 |
| `get_agent_reputation` | Onchain reputation (0-100) from ERC-8004 identity + USDC settlement velocity + recency | $0.02 |
| `ask_x402_settlements` | Natural-language Q&A over the x402 Base settlements warehouse (`answer`, `sql_trace`). Not for general protocol data — use `route` for that. | $0.05 |

`get_preview` takes `{ "q": "uniswap v3 pools" }`. `route` takes `{ "request": "uniswap v3 pools" }` (optional `{ "execute": false }` skips running the query). `ask_x402_settlements` takes `{ "question": "..." }`. The score actions take `{ "wallet": "0x..." }`.

## Wallet Providers

`get_preview` does not need a wallet. Paid actions require an `EvmWalletProvider` because payments settle in USDC on Base.

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
User: What are the top Uniswap V3 pools?
Agent: (calls get_preview) live top-3, including USDC/WETH. Then (calls route)
       returns the full result rows plus the verified query — paid $0.01 USDC on Base.

User: Before I mirror 0x38e5…8a4a on Hyperliquid, is this a sharp trader?
Agent: (calls get_hyperliquid_trader_score) skill_score 71.4, classification "sharp" — paid $0.02 USDC on Base.
```

## Notes

- Payment only settles on a `200`. Non-200 responses return `success: false` and do **not** charge.
- The per-call price is checked against `maxPaymentUsdc` before any signature, so a misconfiguration cannot overspend.
- `GET /hyperliquid/score` accepts `{ "user" }` (documented) and `{ "wallet" }` (also accepted). This provider sends both.
