# x402 Bazaar Action Provider

This directory contains the **X402BazaarActionProvider**, which screens Base, Arbitrum and Solana tokens for safety before an agent buys or approves them, using the [x402 Bazaar](https://402.com.tr) token-verdict API.

## Overview

`token_verdict_check` returns a **SAFE / CAUTION / AVOID / UNKNOWN** verdict with a confidence score, a one-line headline, the reasons behind it, and a recommended maximum position size — distilling the full pre-trade stack (honeypot, sell-tax, owner powers, exit-liquidity, freeze/seize controls) into one decision.

By default it uses the free daily tier (1 full call/day per IP, no wallet needed). When `enablePayment` is set and an EVM wallet is available, it pays $0.03 USDC per call over x402.

## Actions

- `token_verdict_check`: Pre-trade safety check for a Base, Arbitrum or Solana token (via the `chain` input).
  - **address** (string, required): The token contract address (`0x` + 40 hex chars).
  - **amountUsd** (number, optional): Intended trade size in USD; tunes the recommended max safe size.

## Network Support

Agent wallet: Base or Arbitrum. Token screening works for Base, Arbitrum and Solana tokens via the `chain` input (all settle in USDC on Base).

## Usage

```typescript
import { x402BazaarActionProvider } from "@coinbase/agentkit";

// Free tier (no wallet needed):
const provider = x402BazaarActionProvider();

// Pay $0.03 USDC/call over x402 with the agent's EVM wallet:
const paidProvider = x402BazaarActionProvider({ enablePayment: true });
```

## Links

- Marketplace: https://402.com.tr
- Machine catalog: https://402.com.tr/.well-known/x402
