# QuantOracle Action Provider

This directory contains the QuantOracle action provider implementation, which gives AgentKit agents access to deterministic quant finance math — Black-Scholes pricing, Kelly Criterion sizing, Monte Carlo simulation, full risk audits, and hedge recommendations.

## Why this exists

AI agents trying to compute Black-Scholes prices, Kelly fractions, or Monte Carlo simulations in-context drift. The numbers are wrong, the Greeks are hallucinated, and the agent can't tell. QuantOracle is grounded math: same inputs always produce the same outputs, tested against published textbook values (Hull, Wilmott, Lopez de Prado), 120 accuracy benchmarks passing.

## Getting Started

No setup required — the free tier covers the calculator endpoints with no signup or API key. Paid composites (`assess_portfolio_risk`, `recommend_hedge`) settle automatically via your AgentKit wallet using x402 micropayments on Base or Solana.

### Optional Environment Variables

```
QUANTORACLE_API_URL  # Override the default https://api.quantoracle.dev (e.g. for staging)
```

## Directory Structure

```
quantoracle/
├── constants.ts                       # API base URL and User-Agent
├── index.ts                           # Main exports
├── quantoracleActionProvider.test.ts  # Tests for the provider
├── quantoracleActionProvider.ts       # Main provider with QuantOracle API actions
├── README.md                          # Documentation
└── schemas.ts                         # Zod schemas for each action
```

## Actions

The provider exposes 5 curated actions. The full QuantOracle API has 73 endpoints; this provider intentionally surfaces only the actions that solve real agent decisions.

- **`price_option`** (free tier) — Black-Scholes option pricing with full Greeks
- **`calculate_kelly`** (free tier) — Kelly Criterion optimal bet sizing
- **`simulate_portfolio`** (free tier) — Monte Carlo with retirement-style withdrawals
- **`assess_portfolio_risk`** ($0.04 USDC via x402) — Composite Sharpe/Sortino/Calmar/maxDD/VaR/CVaR/Kelly/Hurst audit
- **`recommend_hedge`** ($0.04 USDC via x402) — Ranked hedge structures (collar, protective put, partial put, inverse)

## Rate Limiting

| Endpoint Tier | Limit |
|---|---|
| Free (no signup) | 1,000 requests per IP per day |
| Paid composites | No limit; $0.04 USDC per call |

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { quantoracleActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [quantoracleActionProvider()],
});
```

## Try without code

The same engine powers 12 free interactive calculators at [quantoracle.dev](https://quantoracle.dev) — useful for verifying outputs before wiring the action provider into your agent.

## Resources

- API documentation: [api.quantoracle.dev/openapi.json](https://api.quantoracle.dev/openapi.json)
- Repository: [github.com/QuantOracledev/quantoracle](https://github.com/QuantOracledev/quantoracle)
- x402 protocol: [github.com/coinbase/x402](https://github.com/coinbase/x402)
