# Floe Working Capital Agent Example

An agent that gets a USDC credit line, calls a paid x402 API, and repays from earnings.

**3,000+ secured working capital lines issued. Zero defaults.**

## What it does

1. **Deposits** USDC and borrows 95% as working capital
2. **Calls** an x402-enabled API using Floe's credit delegation (gas-free)
3. **Checks** loan health and accrued interest
4. **Repays** — deposit returns automatically

## Prerequisites

- Node.js 18+
- USDC on Base (or buy from the [dashboard](https://dev-dashboard.floelabs.xyz) with a bank account or card)
- An RPC endpoint (Alchemy, Infura, or similar)

## Setup

```bash
cp .env.example .env
# Edit .env with your private key, RPC URL, and OPENAI_API_KEY
pnpm install
```

## Run

```bash
pnpm start
```

## Why agents need this

100M+ x402 machine payments since May 2025. 100,000+ agents with onchain identity. Zero credit outstanding to any of them. Every economy runs on credit — Floe is the credit layer for the agent economy.

## Learn more

- [Floe Docs](https://floe-labs.gitbook.io/docs)
- [Bank Account → First API Call](https://floe-labs.gitbook.io/docs/agents/fiat-to-x402)
- [Full npm package (45 actions)](https://www.npmjs.com/package/floe-agent)
