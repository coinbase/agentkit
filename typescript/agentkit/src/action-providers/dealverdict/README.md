# Deal Verdict Action Provider

This directory contains the **DealVerdictActionProvider** implementation, which adds a pre-checkout deal gate for shopping agents.

It wraps the live [Deal Verdict](https://x402-web-reader.vercel.app/api/deal-verdict) endpoint — a single x402-gated POST ($0.01 USDC on Base, no API key) that returns a verdict card for a product + found price: `real_deal | fake_discount | overpriced | fair`, the lowest price found elsewhere, the typical price, and the cited sources behind every price (live web search across major retailers via Tavily; every price is extracted from a cited source, never invented).

## Directory Structure

```
dealverdict/
├── dealVerdictActionProvider.ts       # Main provider (check_deal action)
├── dealVerdictActionProvider.test.ts  # Tests for the provider, gate, and payment validation
├── schemas.ts                         # Check-deal input + provider config schemas
├── constants.ts                       # Endpoint, price, payTo, and network constants
├── utils.ts                           # Gate rule + 402 payment-requirement validation
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `check_deal`: Pay $0.01 via x402 and check a price before buying it
  - Input: `product` (name or product page URL), `price` (USD, required), `compareAtPrice` (claimed "was" price, optional), `url` (product page URL, optional)
  - Output: `{ success, allowed, card }` where `card` is the verdict card

## The gate rule

```
real_deal / fair            -> allowed: true  — buy at this price
fake_discount / overpriced / anything else -> allowed: false — do not buy here; use card.lowestFound
```

The rule fails closed: an unknown or missing verdict blocks the purchase at the checked price.

## Spend safety

- The endpoint URL is a constant in `constants.ts`, never caller-supplied, so the action cannot be pointed at an arbitrary paid URL.
- Before signing, the provider makes an unpaid pre-flight request, decodes the 402, and refuses to pay unless the ask matches the known terms: Base mainnet (`eip155:8453`), at most $0.01, payTo `0xea8B7221507d1A0549e1ab96000a54401A7fDaC1`.
- The optional `maxPaymentUsdc` config can only lower the cap below $0.01.
- A failed check (HTTP 502 from the endpoint — fewer than 3 priced sources could be found) is never charged — x402 does not settle on a non-200 response.

## Usage

```typescript
import { AgentKit, dealVerdictActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [dealVerdictActionProvider()],
});

// The check_deal action is now available to the agent. Instruct it:
// "Before buying any product, call check_deal with the product and the
//  price you found. Only buy at that price if the result is allowed;
//  otherwise show the user card.lowestFound instead."
```

## Network Support

Payments are Base mainnet only (`base-mainnet`). The Deal Verdict endpoint itself is network-agnostic (it only searches prices); the x402 payment settles in USDC on Base.

## Adding New Actions

1. Define the action schema in `schemas.ts`
2. Implement the action in `dealVerdictActionProvider.ts`
3. Add tests in `dealVerdictActionProvider.test.ts`
