# x402 Doctor Action Provider

This provider lets an agent check an x402 endpoint **before paying it**, using the [x402 Doctor](https://x402-doctor.onrender.com) preflight. It complements the [x402 action provider](../x402/README.md): after `make_http_request` returns a 402 for an endpoint the agent has not used before, `preflight_x402_endpoint` answers whether paying it is safe, and only then does the agent call `retry_http_request_with_x402`.

## Directory Structure

```
x402Doctor/
├── x402DoctorActionProvider.ts       # Provider with the preflight action
├── x402DoctorActionProvider.test.ts  # Unit tests
├── schemas.ts                        # Action input schema
├── index.ts                          # Exports
└── README.md                         # This file
```

## Setup

No API key. The preflight costs **$0.001 in USDC**, paid via x402 from the agent's wallet on **Base mainnet or Solana mainnet** (never more than $0.002 per preflight, only on the wallet's own network).

```typescript
import { AgentKit, x402ActionProvider, x402DoctorActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [x402ActionProvider(), x402DoctorActionProvider()],
});
```

Optional configuration: `x402DoctorActionProvider({ doctorUrl })` (or the `X402_DOCTOR_URL` environment variable) to use another instance of x402 Doctor.

## Actions

| Action | Description |
|--------|-------------|
| `preflight_x402_endpoint` | Checks an x402 endpoint before paying it; returns `go`, `caution` or `no_go` with reasons, the recommended payment option and advice |

Inputs: `url` (the endpoint about to be paid), `method` (`GET` or `POST`, default `GET`), `maxUsd` (optional budget per call in USD; above it the verdict is `no_go`).

## What the preflight checks

The preflight reads the endpoint's 402 payment requirements and checks:

- the price against the budget and against what the service advertises
- whether the option is payable on the wallet's network (USDC, a valid payout address, a Solana payout account that exists)
- HTTPS
- the endpoint's payability track record
- whether the endpoint is listed in the CDP Bazaar

| Verdict | What the agent should do |
|---------|--------------------------|
| `go` | Pay the recommended option with `retry_http_request_with_x402` |
| `caution` | Show the user the summary and pay only after they confirm |
| `no_go` | Do not pay |

If the preflight fails, the action returns an error without a verdict, and the agent should not pay. The preflight checks whether a payment can succeed and is sensible; it does not verify what the service delivers after payment.

## Network Support

Base mainnet (`base-mainnet`) and Solana mainnet (`solana-mainnet`).
