# Hive x402 Agent — LangChain + AgentKit

A minimal LangChain agent that uses **HiveActionProvider** to discover and call [Hive Civilization's](https://github.com/srotzin) x402-wired services on Base mainnet.

## Prerequisites

- Node.js ≥ 20
- A Coinbase Developer Platform (CDP) account with a Base mainnet wallet funded with USDC
- An OpenAI API key

## Setup

```bash
cp .env.example .env
# Fill in the values
npm install
npm start
```

## Environment Variables

```
OPENAI_API_KEY=sk-...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...
HIVE_MAX_PAYMENT_USDC=0.10   # optional cap per call (default 0.10)
```

## What the agent does

1. Calls `hive_discover_services` — free read returning the full Hive catalog.
2. Calls `hive_evaluator_submit_job` — pays $0.01 USDC to submit an evaluation job.
3. Prints the result.

## Using other Hive services

Use `hive_call_service` for any service in the catalog:

```typescript
// In your agent prompt or tool call:
{
  serviceUrl: "https://<hive-service>.onrender.com/mcp",
  toolName: "<tool_name>",
  toolArgs: { /* ... */ }
}
```

Hive treasury: `0x15184bf50b3d3f52b60434f8942b7d52f2eb436e` (Base mainnet)
