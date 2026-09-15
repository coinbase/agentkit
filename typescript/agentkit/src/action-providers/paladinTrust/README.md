# PaladinFi Trust Action Provider

This directory contains the **PaladinTrustActionProvider** implementation, which provides an action to query the **PaladinFi Trust Check API** for pre-swap token-risk evaluation on Base.

## Directory Structure

```
paladinTrust/
├── paladinTrustActionProvider.ts        # Main provider with trust-check functionality
├── paladinTrustActionProvider.test.ts   # Tests
├── schemas.ts                           # Action input schemas
├── index.ts                             # Main exports
└── README.md                            # This file
```

## Actions

- `check_token_risk`: Get a composed-risk recommendation for a token contract on Base
  - Returns `recommendation` (`sample-allow` | `sample-warn` | `sample-block` on the preview endpoint this provider calls) plus per-factor breakdown (OFAC SDN, GoPlus, Etherscan source verification, anomaly heuristics)
  - Does not execute any transactions and does not require a wallet signature
  - Calls `POST /v1/trust-check/preview` (free, sample-fixture response — recommendation is `sample-` prefixed and every factor has `real: false`)

For paid mode with x402 settlement ($0.001 USDC per live evaluation on Base), use the external [`@paladinfi/agentkit-actions`](https://www.npmjs.com/package/@paladinfi/agentkit-actions) package.

## Adding New Actions

To add new PaladinFi Trust actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `paladinTrustActionProvider.ts`
3. Add tests in `paladinTrustActionProvider.test.ts`

## Network Support

The PaladinFi Trust provider supports Base mainnet (`chainId 8453`) only. `supportsNetwork` rejects all other networks.

## Configuration

The provider takes optional configuration:

```typescript
const provider = paladinTrustActionProvider({
  apiBase: "https://swap.paladinfi.com", // optional; defaults to the production endpoint. Override only for local testing (http://localhost[:port]).
  sendTaker: false, // optional; default false. When true, the wallet's address is sent to the API as the "taker" field for anomaly heuristics.
});
```

Configuration is constructor-only. There are no environment-variable fallbacks (this matches the in-tree `zeroX` / `sushi` / `enso` convention).

## Privacy

By default, this provider does **not** send the agent's wallet address to `swap.paladinfi.com`. The request body contains only `{chainId, address}`. Set `sendTaker: true` in the constructor if you want the API to include the wallet address as the `taker` field — this improves the anomaly heuristic signal at the cost of sharing the wallet address with the API on every call.

## Notes

- This action provider is **decision-only**. It does not sign or send any swap. Compose it with AgentKit's `zeroX`, `enso`, or `sushi` providers to actually execute a swap.
- The preview endpoint returns a sample fixture — `recommendation` is one of `sample-allow` / `sample-warn` / `sample-block`, and every factor has `real: false`. The "sample-" prefix exists so the response cannot be cropped into looking like a real evaluation.
- On the paid endpoint (available via `@paladinfi/agentkit-actions`), when all upstream sources are temporarily unreachable, the API returns `recommendation: "warn"` (fail-closed, never silent-allow). Clients keying off `allow` should treat anything else as not-allowed.

For more information on the **PaladinFi Trust Check API**, visit [paladinfi.com/trust-check/](https://paladinfi.com/trust-check/).
