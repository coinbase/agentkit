# Fodda Action Provider

This Action Provider enables Coinbase AgentKit agents to autonomously query market intelligence, trend graphs, and curated domain research from the [Fodda Context Layer](https://fodda.ai).

When an agent requests a protected graph, the provider handles HTTP 402 payment challenges by autonomously transferring 5¢ USDC on Base Mainnet, respecting block finality `Retry-After` headers, and fulfilling the paid query.

## Actions

- `query_fodda_context`: Queries verified intelligence graphs (e.g. `psfk-retail`, `food-beverage`, `hospitality`).

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { foddaActionProvider } from "@coinbase/agentkit/action-providers/fodda";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    foddaActionProvider(),
  ],
});
```
