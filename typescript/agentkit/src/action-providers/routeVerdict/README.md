# RouteVerdict Action Provider

This directory contains the **RouteVerdictActionProvider** implementation, which gives AI agents a native `route_verdict` action: a pay-per-call trust check for x402 endpoints themselves.

RouteVerdict is a live [x402](https://x402.org) service: send any x402 resource URL, get back a verdict (**TRUSTED / CAUTION / AVOID**), a 0–100 trust score with itemized reasons, liveness, the endpoint's live payment terms, its Bazaar discovery-schema quality, catalog presence, and a diff against the previous check of the same URL. The check is observation-only — the target is probed, never paid. It costs **$0.05 USDC per call on Base**, paid automatically from the agent's own wallet provider — no accounts, no API keys.

## Directory Structure

```
routeVerdict/
├── routeVerdictActionProvider.ts       # Main provider with the route_verdict action
├── routeVerdictActionProvider.test.ts  # Test file for the RouteVerdict provider
├── schemas.ts                          # Action schema (the service's request contract)
├── constants.ts                        # Service URL, price, and network constants
├── utils.ts                            # x402 paying fetch + spend-guard policy
├── index.ts                            # Main exports
└── README.md                           # This file
```

## Actions

- `route_verdict`: Gets a trust verdict on an x402 endpoint before paying it

## Setup

To use the RouteVerdict action provider:

```typescript
import { routeVerdictActionProvider } from "@coinbase/agentkit";

const provider = routeVerdictActionProvider();

// Or with overrides (e.g. a different service deployment or price guard)
const providerWithOptions = routeVerdictActionProvider({
  baseUrl: "https://route-verdict-production.up.railway.app", // default
  maxAmountPerPayment: "$0.05", // spend guard, defaults to the known price
});
```

The wallet provider must be an EVM wallet on Base mainnet — payment settles in USDC on Base.
