# SpendPreflight preflight action

We operate [SpendPreflight](https://spendpreflight.com), a **paid API**. This contribution was prepared by its operator with AI assistance. Live preflight screening costs **$0.02 in Base USDC**, separately from any merchant payment. This is not a Coinbase service or endorsement.

The provider registers one `preflight_payment` action. Its default is **offline hold, with no signer and no screening request**. It does not expose standalone payee screening, trial enrollment, automatic fee payment, wallet access or merchant execution. No new dependency is required.

```typescript
import { spendpreflightActionProvider } from "@coinbase/agentkit";

const provider = spendpreflightActionProvider(); // offline hold
// Add this provider to an existing AgentKit configuration, if desired.
// AgentKit's normal registered-action telemetry is independent of this reviewer.
```

## Offline example and tests

`offlineExample.ts` calls the same reviewer directly, without creating a wallet, model or registered action. It returns `{decision: "hold", reasons: ["offline: screening client not configured"], payment: "not_attempted"}`. The colocated test executes this example and fails on any accidental global fetch. The action-registration test mocks AgentKit's analytics; no telemetry or external request is sent.

From `typescript/agentkit`:

```sh
pnpm exec jest --runInBand src/action-providers/spendpreflight/spendpreflightActionProvider.test.ts
pnpm check
```

## Explicit live configuration

An application may supply `screeningFetch` and operator-owned `rules` through the constructor. This callback is trusted application configuration, never a model input. Plain `fetch` will receive a payment challenge and return hold; this provider does not pay it. A payment-enabled client needs a separate explicit screening budget and must enforce the exact API origin, fee, asset, network and recipient before signing. No such client or signer is bundled, and there is no trial or paid fallback.

The reviewer sends one POST to `https://api.spendpreflight.com/v1/preflight`, rejects redirects, supplies an 8-second abort signal and caps input/output at 64/128 KiB. The transport must honor that signal. Merchant URLs are input data only; they are never fetched. Failures, non-2xx responses and malformed results hold, with no retries. The response receipt is preserved but its signature is **not cryptographically verified here**.

## Application payment boundary

Calling a risk tool does not automatically guard another payment tool. Before enabling a merchant signer, the application must bind the selected challenge and quote to its immutable order, verify the decision receipt, enforce policy and a durable atomic budget/reservation, and reject hold/block, expired quotes and unknown outcomes. Rules and spend history must come from trusted application state. Never expose a second payment path that bypasses these checks. An allow is informational; this action does not itself authorize, sign or settle anything.

Tests use synthetic HTTP results, not live screening, chatbot/model calls, RPC or settlements. No safety, legal-compliance or paid-delivery guarantee is made.
