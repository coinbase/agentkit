# X402check Action Provider

Trust-preflight x402 seller URLs **before** an agent pays them, using [x402check](https://x402check.dev).

Each check returns a compact `ok | caution | avoid` verdict plus that tool's history (uptime, `payTo` / price drift). This is an **endpoint + history** product — not wallet OFAC, drainer detection, or transaction simulation.

x402check is a strong fit for the neutral `beforePayment` seat in [#1454](https://github.com/coinbase/agentkit/pull/1454): it probes the seller's **live 402** (price, network, `payTo`) and compares those against that URL's history, including **payTo-change detection** — signals recipient-reputation screens alone can miss when a payment address is substituted in transit.

## Directory Structure

```
x402check/
├── x402checkActionProvider.ts      # Actions: preflight_check, verify_payto
├── beforePayment.ts                # Drop-in beforePayment helper (#1454 shape)
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

// Prefer a payment-wrapped fetch so the $0.01 Exact USDC Base charge settles.
const paidFetch = wrapFetchWithPayment(fetch, /* your signer + ExactEvmScheme */);

const x402check = x402checkActionProvider({
  // Optional — defaults to https://x402check.dev (or X402CHECK_URL)
  baseUrl: "https://x402check.dev",
  fetch: paidFetch,
  // When true, caution verdicts abort beforePayment (default: false)
  abortOnCaution: false,
  // When true, check failures allow payment (default: false = fail closed)
  failOpen: false,
});
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `X402CHECK_URL` | Override API origin |
| `X402CHECK_SKIP=1` | Kill-switch: return synthetic `ok` (tests / local) |

### Billing

x402check charges **$0.01 USDC Exact on Base (`eip155:8453`)** per tool checked (x402 v2 `PAYMENT-SIGNATURE`). Pass `config.fetch = wrapFetchWithPayment(...)` or supply a prior `paymentHeaders` map. Unpaid calls return a structured `x402check_payment_required` error with a hint — they do not throw past the action boundary.

## Actions

1. **`preflight_check`** — `GET /preflight?url=…` for one absolute https seller URL. Returns verdict + history + guidance.
2. **`verify_payto`** — Same endpoint/billing; response focused on `payTo`, optional `expectedPayTo` match, and `history.payToChanges`.

## beforePayment hook (drop-in for #1454)

One-line usage — plug x402check into the neutral `beforePayment` seat:

```typescript
import { x402ActionProvider, createX402checkBeforePayment } from "@coinbase/agentkit";

const x402 = x402ActionProvider({
  registeredServices: ["https://api.example.com"],
  maxPaymentUsdc: 0.5,
  beforePayment: createX402checkBeforePayment({ fetch: paidFetch }),
});
```

`createX402checkBeforePayment` returns the exact `#1454` decision shape `{ abort: boolean, reason?: string, code?: string }` (no extra fields). Context/decision types are defined locally in this package so the helper works **before #1454 merges** — it does not import unmerged symbols from the x402 provider.

### Policy

| Signal | Default behavior | Override |
| --- | --- | --- |
| verdict `avoid` | `abort: true`, `code: "x402check:avoid"` | — |
| verdict `caution` | `abort: false`, `code: "x402check:caution"` | `abortOnCaution: true` → abort |
| verdict `ok` | `abort: false`, `code: "x402check:ok"` | — |
| live `payTo` ≠ context `payTo` | `abort: true`, `code: "x402check:payto_mismatch"` | — |
| live network ≠ context network | noted in `reason`; no abort | `abortOnCaution: true` → abort |
| preflight error / missing url | `abort: true` (fail closed) | `failOpen: true` → allow with `code: "x402check:unavailable"` |

Until #1454 merges, agents can still call `preflight_check` / `verify_payto` as explicit tools before `retry_http_request_with_x402`.

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
