# MEV Intelligence Action Provider

Real-time Ethereum liquidation intelligence for AI agents.

Monitor near-liquidation borrowers across **Aave V3**, **Spark**, and **Morpho Blue** with live health factor data. Built for autonomous agents that need MEV-aware DeFi risk signals.

## Actions

| Action | Description | Free | Paid (x402) |
|---|---|---|---|
| `get_liquidation_waves` | Near-liquidation borrowers ranked by HF | Top 10 | Full universe ($0.50/call) |
| `get_searcher_leaderboard` | MEV searchers ranked by landed fires | Top 5 | Full 25-entry ($0.25/call) |
| `get_builder_recommendation` | Optimal block builder for bundle routing | Top 1 | Ranked list ($0.25/call) |
| `get_mev_feed` | Enriched MEV event stream | 10 events | Full stream ($0.10/call) |

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { mevIntelligenceActionProvider } from "@coinbase/agentkit/action-providers/mev-intelligence";

const agentKit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
  actionProviders: [
    mevIntelligenceActionProvider(),
    // ... other providers
  ],
});
```

## Free Preview

All 4 actions work without any API key using the free preview tier (rate-limited to 60 req/hr):

```bash
curl https://mev.advalorem.io/preview/liquidation-waves
curl https://mev.advalorem.io/preview/searcher-leaderboard
curl https://mev.advalorem.io/preview/builder-recommendation
curl https://mev.advalorem.io/preview/feed
```

## Paid Tier (x402)

Full data access uses [x402 micropayments](https://x402.org) — USDC on Base, pay per call. No subscription, no API key management. Agents with a CDP wallet can pay autonomously.

```bash
# Verify API key tier
curl -H "X-Api-Key: <your-key>" https://mev.advalorem.io/intelligence/whoami
```

## MCP Integration

MEV Intelligence is also available as an MCP server:

```
https://mev.advalorem.io/mcp
```

Compatible with Claude Desktop, GPT function calling, and any MCP-compatible agent framework.

## Links

- Dashboard: [https://mev.advalorem.io](https://mev.advalorem.io)
- OpenAPI spec: [https://mev.advalorem.io/intelligence/openapi](https://mev.advalorem.io/intelligence/openapi)
- MCP endpoint: [https://mev.advalorem.io/mcp](https://mev.advalorem.io/mcp)
- Support: val@advalorem.io
