# DEBYKO Action Provider

Typed actions for the DEBYKO market-data API.

An AgentKit agent can already discover, call, and pay DEBYKO through the built-in x402 provider and the
[Agentic Market listing](https://agentic.market/services/api-debyko-com). This provider does not replace
that path. It adds DEBYKO descriptions, DQL guidance on screen, passthrough of `code`, `message` and `hint`,
an optional Bearer key that never falls back to x402, and a per-call cap checked before anything is signed.

The payment path uses the same client as the x402 provider: `x402Client`, `toSigner()` with `readContract`,
`registerExactEvmScheme`, and `wrapFetchWithPayment`. Registration is limited to `eip155:8453`. The library's
default spend control is one dollar, so offers that are not an exact payment in native USDC on that network,
at or under the cap, are dropped before a signature. The cap defaults to 0.05 USDC. A `PAYMENT-REQUIRED`
header that cannot be read is refused the same way.

`apiKey` sends `Authorization: Bearer` and does not enter x402. A failed Bearer response is returned as
DEBYKO wrote it.

DEBYKO answers a paid request before the payment settles, so a success usually has no settlement header.
The JSON is returned, and no transaction hash is invented. When `PAYMENT-RESPONSE` is present it is parsed.

Guide: [Use DEBYKO from AgentKit](https://docs.debyko.com/api/agentkit/). DQL: [https://docs.debyko.com/dql/guide/](https://docs.debyko.com/dql/guide/).

## Actions

| action | request | price |
| --- | --- | --- |
| `debyko_snapshots` | `POST /v2/snapshots` | 0.005 USDC |
| `debyko_screen` | `POST /v2/screen` | 0.01 USDC |
| `debyko_history` | `POST /v2/snapshots/history` | 0.02 USDC |

`debyko_screen` takes a DQL query, a limit and `include_unknown`. Names in the query come from the catalogue.
Each value carries its venue, its age and its status. A stale value is withheld.

```typescript
import { debykoActionProvider } from "@coinbase/agentkit";

const provider = debykoActionProvider({ maxPaymentUsdc: 0.05 });
```
