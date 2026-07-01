# invinoveritas Action Provider

This directory contains the invinoveritas action provider implementation, which provides actions to
get an independent, capital/risk-aware verdict on a proposed agent action before it executes, and to
verify a signed proof another agent hands you.

invinoveritas is a verification layer for autonomous agents: a neutral second opinion before an
irreversible action (`review`), and a free, no-auth way to check a proof another agent presents
(`verify_proof`) without trusting the presenter or invinoveritas — only the math (BIP-340 schnorr
against a published key). The verifier keeps a public, Bitcoin-anchored track record of past verdicts
(wins and losses) at `/ledger`.

Both actions are automated and advisory — the agent decides, and a review call never blocks or throws
into the agent's main flow. This is not a human-in-the-loop approval step.

## Getting Started

`verify_proof` requires no configuration — it's free and unauthenticated. `review` needs an API key:

1. Get one free: `POST https://api.babyblueviper.com/register {"label":"your-app"}` (free trial calls
   included, no funding needed to start)
2. Fund with Lightning sats, USDC (x402 on Base), or a card for continued paid use

### Environment Variables

```
INVINOVERITAS_API_KEY
```

Alternatively, configure the provider directly:

```typescript
import { invinoveritasActionProvider } from "@coinbase/agentkit";

const provider = invinoveritasActionProvider({
  apiKey: "your_invinoveritas_api_key",
});
```

## Directory Structure

```
invinoveritas/
├── constants.ts                          # API base URL, timeout, error strings
├── invinoveritasActionProvider.test.ts   # Tests for the provider
├── invinoveritasActionProvider.ts        # Main provider: review + verify_proof
├── index.ts                              # Main exports
├── README.md                             # Documentation
├── schemas.ts                            # Action input schemas
├── types.ts                              # Type definitions
└── utils.ts                              # postJson fetch helper (shared timeout/error handling)
```

## Actions

- `review`: Get an independent verdict on a proposed action before executing it
  - `artifactType='trade'` for a capital-scale-aware risk review (position size vs equity, drawdown, regime)
  - `artifactType='onchain_action'` for deterministic checks (unlimited approvals, drainers, address poisoning, permit abuse, wrong-chain recipient)
  - `artifactType='sanctions_screening'` for an overclaim-boundary check on a compliance verdict
  - `sign=true` returns a portable signed proof any third party can recompute (`POST /verify-proof`), independent of trusting invinoveritas's pipeline
  - Returns `{ verdict, confidence, summary, issues, alternative_approaches, onchain_risk, proof? }`
  - Degrades to `{ verdict: "review_unavailable", reason }` on missing key, timeout, or a non-2xx response — never throws

- `verify_proof`: Verify a signed invinoveritas proof another agent handed you (free, no auth)
  - Recomputes the Nostr event id and checks the BIP-340 schnorr signature against the published key
  - Pass the signed `event` object, or a stored `proofId`
  - Returns `{ valid: true|false, checks: {...} }`

## Network Support

`invinoveritas` is API-only — it makes HTTP calls, not wallet operations — so `supportsNetwork` always
returns `true`. No wallet provider is required to use this action provider.

## Notes

Unlike most action providers in this repo, the constructor does **not** throw when no API key is
configured. `verify_proof` is a free action that works with zero configuration, and `review` is
designed to degrade to an advisory `review_unavailable` result rather than block agent construction
for a user who hasn't set up a key yet.

## Adding New Actions

To add new invinoveritas actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `invinoveritasActionProvider.ts`
3. Add corresponding tests in `invinoveritasActionProvider.test.ts`

For more information on invinoveritas, visit [api.babyblueviper.com](https://api.babyblueviper.com).
