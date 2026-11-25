# Predge Action Provider

This directory contains the **PredgeActionProvider**, which lets an agent check whether a Polymarket market's resolution is settled, disputed or at risk before it acts on that market. Records are read live from UMA's Optimistic Oracle on Polygon and signed by [Predge](https://predge.io) with ed25519; the provider verifies each signature against Predge's published key.

## Directory Structure

```
predge/
├── predgeActionProvider.ts        # Main provider
├── predgeActionProvider.test.ts   # Tests
├── constants.ts                   # API URL, pinned public key, accepted USDC assets
├── schemas.ts                     # Action schemas
├── types.ts                       # Config and verification types
├── utils.ts                       # Canonical JSON, ed25519 verification, summaries
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `get_settlement_risk` (free, no API key): signed settlement-risk record for a market (condition id, numeric market id or slug). Returns `risk_level` (`ok`, `watch`, `caution`, `resolved`), the UMA state, disputes and the signature check.
- `verify_predge_record` (free, offline): verifies a Predge signed record against the pinned key: canonical bytes, payload, content hash and envelope signature.
- `get_settlement_estimate` ($0.02 USDC per call over x402): the same signed record plus `settlement_estimate`, the calibrated probability that a disputed market settles differently from the disputed proposal. Failed requests (400/404/422/502) are not charged.
- `get_whale_trades` ($0.005 USDC per call over x402): latest Polymarket trades of $10,000+ notional, delayed 15 minutes.

Paid actions pay from the agent's wallet only in USDC on its own network (Base mainnet or Solana mainnet), and never more than `maxPaymentUsd` per call.

## Configuration

```typescript
import { predgeActionProvider } from "@coinbase/agentkit";

predgeActionProvider({
  maxPaymentUsd: 0.05, // per-call cap for paid actions; 0 disables them
});
```

No API key is needed.

## Network Support

The free actions work with any wallet and network. Paid actions need an EVM wallet on Base mainnet or a Solana wallet on Solana mainnet.

## Notes

- API docs: https://predge.io/docs, OpenAPI: https://api.predge.io/openapi.json
- Signing key set: https://api.predge.io/.well-known/predge-keys.json
- Canonicalization spec: https://data.predge.io/canonicalization.md
