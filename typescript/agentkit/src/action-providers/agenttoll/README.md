# AgentToll Action Provider

Base-native onchain data for agents, pay-per-call over [x402](https://x402.org):
each action costs $0.001–$0.008 in USDC, paid automatically from the agent's
wallet. No API keys, no accounts — and a failed request is never charged, since
settlement only happens when data is returned.

Backed by [agenttoll.app](https://agenttoll.app) (open source, MIT), settled
through the Coinbase CDP facilitator on Base mainnet.

## Actions

| Action | What it answers | Price |
|---|---|---|
| `scout_new_base_tokens` | What launched on Base today, and is any of it safe to touch? New pools with a safety verdict attached | $0.008 |
| `check_base_token_safety` | Is this token a honeypot? Simulated buy & sell, taxes, owner powers, holder concentration, deployer history | $0.003 |
| `get_base_wallet_portfolio` | What does this address hold, in USD? ETH + ERC-20s, largest first, spam floor | $0.003 |
| `get_base_token_price` | What is this token worth right now? Priced from onchain DEX liquidity | $0.001 |
| `resolve_basename` | Who is `jesse.base.eth`? Name → address + records, or address → primary name | $0.001 |
| `get_market_brief` | One-call snapshot: prices, Base gas, Fear & Greed | $0.005 |

Safety verdicts are deliberately conservative: a check that could not run is
never a "pass", and a token too new to judge is reported `insufficient-data`,
never `clear`.

## Setup

```typescript
import { AgentKit, agenttollActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [agenttollActionProvider()],
});
```

The wallet needs a little USDC on Base mainnet — a dollar covers hundreds of
calls. Supported network: `base-mainnet`.

## Notes

- Every endpoint also answers unauthenticated with an x402 v2 quote that
  carries its own request/response schema, so agents can discover the API
  without this provider: `curl -i https://agenttoll.app/api/base/scout`.
- Machine-readable catalog: https://agenttoll.app/api/catalog ·
  discovery: https://agenttoll.app/.well-known/x402
- Usage stats are read from USDC transfers onchain, not self-reported:
  https://agenttoll.app/api/stats
