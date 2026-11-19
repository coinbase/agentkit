# Edge Signals Action Provider

This directory contains the **EdgeSignalsActionProvider**, which exposes [Token Verdict](https://signals.edge.report) as an optional pre-trade token risk check.

Token Verdict is a paid x402 resource: **$0.01 USDC on Base per call**, charged to the agent's wallet. There is no API key. It is built by Konstantin Bozukov / Edge Signals and is opt-in — add the provider to your AgentKit instance only if you want this tool available.

## Directory Structure

```
edgesignals/
├── edgesignalsActionProvider.ts       # Main provider
├── edgesignalsActionProvider.test.ts  # Unit tests
├── schemas.ts                         # Action input schemas
├── constants.ts                       # API URL and price constants
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `get_token_verdict`: Fetch a pre-trade risk verdict for an ERC-20
  - Inputs: `token` (contract address), `chain` (optional, defaults to `base`)
  - Returns a letter grade (A–F), a band (`SAFE` | `CAUTION` | `AVOID`), a score from 0–100, and human-readable reasons
  - Costs $0.01 USDC on Base via [x402](https://docs.cdp.coinbase.com/x402/overview)
  - Endpoint: `GET https://signals.edge.report/v1/token-verdict?token={address}&chain={chain}`

## Usage

The agent's EVM wallet must be on Base mainnet and funded with a small amount of USDC to pay for calls.

```typescript
import { edgeSignalsActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    // ...your other providers
    edgeSignalsActionProvider(),
  ],
});
```

The action is only offered when `supportsNetwork` is true for the wallet's current network (Base mainnet).

## Notes

- This provider does not change existing swap or transfer actions. Agents should call `get_token_verdict` before interacting with an unknown token.
- Token Verdict is not financial advice.
- Further docs: [catalog](https://signals.edge.report/v1/catalog), [OpenAPI](https://signals.edge.report/openapi.json), [integration kits](https://github.com/konstantinbozukov/edge-signals-kits).
