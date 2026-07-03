# The Graph Action Provider

This directory provides an action provider for querying [The Graph](https://thegraph.com) directly from an agent, paying **per query** over x402 from the agent's own wallet. It exposes discovery, schema introspection, and paid GraphQL query actions across every subgraph on the network — no API key, no signup.

The discovery + query-construction logic is ported from [PayQL](https://github.com/PaulieB14/payql) (Apache-2.0); payment is signed with the agent's AgentKit wallet.

## Actions

| Action | What it does | Cost |
|---|---|---|
| `search_subgraphs` | Find the best subgraph(s) for a plain-English topic (id, name, signal) | ~$0.01 USDC (free if a registry is configured) |
| `get_subgraph_schema` | List a subgraph's queryable entities + arguments | ~$0.01 USDC |
| `query_subgraph` | Run a GraphQL query against a subgraph | per-query gateway price (~$0.01) |

Typical flow: `search_subgraphs` → `get_subgraph_schema` → `query_subgraph`.

## How payment works

Query prices are variable, so each paid action **probes the gateway's 402 price first, checks it against `maxPaymentUsdc`, and only then signs and pays** — a query priced above the cap is refused before any signature. Payments settle in USDC on Base using the same x402 signing stack as the built-in `x402` provider, so **no new dependencies**.

## Wallet Providers

Requires an `EvmWalletProvider` (payments settle in USDC on Base). Base mainnet only.

## Configuration

```typescript
import { theGraphActionProvider } from "@coinbase/agentkit";

const provider = theGraphActionProvider({
  // Per-query spend ceiling in whole USDC (default THE_GRAPH_MAX_PAYMENT_USDC env, then 1.0).
  maxPaymentUsdc: 0.05,
  // Optional free discovery endpoint (e.g. a curated subgraph registry). If unset,
  // search_subgraphs runs a tiny paid query against The Graph's network subgraph.
  // registryUrl: "https://...",
});
```

## Example

```
User: What are the 5 most recent swaps on Uniswap v3 (Arbitrum)?
Agent:
  1. search_subgraphs({ query: "uniswap v3 arbitrum" })      -> picks a subgraph id
  2. get_subgraph_schema({ subgraphId })                     -> sees `swaps` entity
  3. query_subgraph({ subgraphId, query: "{ swaps(first: 5, orderBy: timestamp, orderDirection: desc) { amountUSD } }" })
     -> data, paid ~$0.01 USDC on Base from the agent's wallet
```

## Relationship to the `graphadvocate` provider

Two tiers over the same protocol:

- **`graphadvocate`** — managed / no setup. The agent pays Graph Advocate, which routes and queries and returns the answer.
- **`thegraph`** (this provider) — self-serve / bring-your-own. The agent queries The Graph gateway **directly** and pays its own way per query. Cheaper, more control, and it drives direct usage of The Graph.
