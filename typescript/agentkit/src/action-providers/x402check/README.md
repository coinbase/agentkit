# X402check Action Provider

Trust-preflight x402 seller URLs **before** an agent pays them, using [x402check](https://x402check.dev).

Each check returns a compact `ok | caution | avoid` verdict plus that tool's history (uptime, `payTo` / price drift). This is an **endpoint + history** product — not wallet OFAC, drainer detection, or transaction simulation.

## Directory Structure

```
x402check/
├── x402checkActionProvider.ts      # Actions: preflight_check, verify_payto
├── beforePayment.ts                # Hook helper for x402ActionProvider (#1454)
├── x402checkActionProvider.test.ts
├── beforePayment.test.ts
├── schemas.ts
├── types.ts
├── constants.ts
├── utils.ts
├── index.ts
└── README.md
```

## Configuration

```typescript
import {
  x402checkActionProvider,
  createX402checkBeforePayment,
} from "@coinbase/agentkit";
import { wrapFetchWithPayment } from "@x402/fetch";

// Prefer a payment-wrapped fetch so the $0.002 Exact USDC Base charge settles.
const paidFetch = wrapFetchWithPayment(fetch, /* your signer + ExactEvmScheme */);

const x402check = x402checkActionProvider({
  // Optional — defaults to https://x402check.dev (or X402CHECK_URL)
  baseUrl: "https://x402check.dev",
  fetch: paidFetch,
  // When true, caution verdicts abort beforePayment (default: false)
  abortOnCaution: false,
});
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `X402CHECK_URL` | Override API origin |
| `X402CHECK_SKIP=1` | Kill-switch: return synthetic `ok` (tests / local) |

### Billing

x402check charges **$0.002 USDC Exact on Base (`eip155:8453`)** per tool checked (x402 v2 `PAYMENT-SIGNATURE`). Pass `config.fetch = wrapFetchWithPayment(...)` or supply a prior `paymentHeaders` map. Unpaid calls return a structured `x402check_payment_required` error with a hint — they do not throw past the action boundary.

## Actions

1. **`preflight_check`** — `GET /preflight?url=…` for one absolute https seller URL. Returns verdict + history + guidance.
2. **`verify_payto`** — Same endpoint/billing; response focused on `payTo`, optional `expectedPayTo` match, and `history.payToChanges`.

## beforePayment hook (with x402ActionProvider)

Once [coinbase/agentkit#1454](https://github.com/coinbase/agentkit/pull/1454) (or equivalent) lands, wire the same check at the settlement chokepoint:

```typescript
import { x402ActionProvider, createX402checkBeforePayment } from "@coinbase/agentkit";

const x402 = x402ActionProvider({
  registeredServices: ["https://api.example.com"],
  maxPaymentUsdc: 0.5,
  beforePayment: createX402checkBeforePayment({
    fetch: paidFetch,
    abortOnCaution: false,
  }),
});
```

The helper matches the `#1454` signature `({ payTo, url, network, asset, amount, method }) => { abort?, reason? }`. Until that PR merges, agents can still call `preflight_check` / `verify_payto` as explicit tools before `retry_http_request_with_x402`.

## Verdict guidance

| Verdict | Recommended agent behavior |
| --- | --- |
| `ok` | Proceed, still enforce `maxPaymentUsdc` / allowlists |
| `caution` | Escalate / require confirmation |
| `avoid` | Do **not** pay |

## Network support

Network-agnostic (`supportsNetwork` → `true`). The paid check itself settles on Base; seller URLs may be any https x402 endpoint.

## Links

- Docs / OpenAPI: https://x402check.dev/docs
- Free sample shape: https://x402check.dev/example
- Client / MCP: https://github.com/x402check/x402check
- Related: [#1402](https://github.com/coinbase/agentkit/issues/1402), [#1454](https://github.com/coinbase/agentkit/pull/1454)
