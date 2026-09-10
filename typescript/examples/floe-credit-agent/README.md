# Floe Financial OS — Agent Example

The full financial loop: fund → borrow → spend → repay. One provider, one agent.

**3,000+ secured working capital lines issued. Zero defaults.**

## What it does

1. **Deposits** USDC and borrows 95% as working capital
2. **Calls** x402 APIs — Floe handles payment automatically (gas-free)
3. **Checks** credit status, loan health, accrued interest
4. **Repays** — deposit returns automatically

## Prerequisites

- Node.js 18+
- USDC on Base (or buy from the [dashboard](https://dev-dashboard.floelabs.xyz) with a bank account or card)
- An RPC endpoint (Alchemy, Infura, or similar)
- An OpenAI API key

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

## The Floe Stack

| # | Component | What this example shows |
|---|---|---|
| 01 | Agent Wallet | ViemWalletProvider setup |
| 02 | Fiat on-ramp | Fund via [dashboard](https://dev-dashboard.floelabs.xyz) (card, bank, Apple/Google Pay) |
| 03 | Secured credit | `instantBorrow` — deposit USDC, get 95% working capital |
| 04 | x402 payments | `x402Fetch` — call any paid API, Floe handles payment |
| 05 | Credit bureau | Every repayment builds the agent's credit record |

## Learn more

- [Quickstart](https://floe-labs.gitbook.io/docs/getting-started/quickstart)
- [Full npm package (45 actions)](https://www.npmjs.com/package/floe-agent)
- [Dashboard](https://dev-dashboard.floelabs.xyz)
