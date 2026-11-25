# Token Verdict Action Provider

This directory contains the **TokenVerdictActionProvider** implementation, which adds a pre-trade token safety gate for Base tokens.

It wraps the live [Token Verdict](https://crypto-intel-agent.vercel.app/api/token-verdict) endpoint — a single x402-gated POST ($0.02 USDC on Base, no API key) that returns a verdict card for a Base token: `clean | caution | rug_risk | exit_trap`, a 0-100 score, reasons, and the facts behind them (liquidity, holder concentration, honeypot / mint / tax flags from DexScreener / GeckoTerminal + GoPlus).

## Directory Structure

```
tokenverdict/
├── tokenVerdictActionProvider.ts       # Main provider (check_token action)
├── tokenVerdictActionProvider.test.ts  # Tests for the provider, gate, and payment validation
├── schemas.ts                          # Check-token input + provider config schemas
├── constants.ts                        # Endpoint, price, payTo, and network constants
├── utils.ts                            # Gate rule + 402 payment-requirement validation
├── index.ts                            # Main exports
└── README.md                           # This file
```

## Actions

- `check_token`: Pay $0.02 via x402 and check a Base token before trading it
  - Input: `tokenAddress` (Base contract address, 0x...)
  - Output: `{ success, allowed, card }` where `card` is the verdict card

## The gate rule

```
clean / caution   -> allowed: true  — the trade may proceed
rug_risk / exit_trap / anything else -> allowed: false — do not trade
```

The rule fails closed: an unknown or missing verdict blocks the trade.

## Spend safety

- The endpoint URL is a constant in `constants.ts`, never caller-supplied, so the action cannot be pointed at an arbitrary paid URL.
- Before signing, the provider makes an unpaid pre-flight request, decodes the 402, and refuses to pay unless the ask matches the known terms: Base mainnet (`eip155:8453`), at most $0.02, payTo `0xea8B7221507d1A0549e1ab96000a54401A7fDaC1`.
- The optional `maxPaymentUsdc` config can only lower the cap below $0.02.
- A failed check (HTTP 502 from the endpoint, data sources down) is never charged — x402 does not settle on a non-200 response.

## Usage

```typescript
import { AgentKit, tokenVerdictActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [tokenVerdictActionProvider()],
});

// The check_token action is now available to the agent. Instruct it:
// "Before buying any Base token, call check_token. Only proceed if
//  the result is allowed; if not, refuse the trade and show the reasons."
```

## Network Support

Base mainnet only (`base-mainnet`). Token Verdict v1 supports Base tokens only.

## Adding New Actions

1. Define the action schema in `schemas.ts`
2. Implement the action in `tokenVerdictActionProvider.ts`
3. Add tests in `tokenVerdictActionProvider.test.ts`
