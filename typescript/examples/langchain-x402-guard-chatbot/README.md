# AgentKit x402 buy loop with an opt-in pre-payment guard

A self-contained example: an AgentKit agent that pays x402 APIs, but **checks the
seller wallet before it pays**. It adds nothing to agentkit core — it composes
the existing `x402ActionProvider` actions with one small, example-local action
provider.

## The buy loop: `inspect → check → decide → pay`

`x402ActionProvider` already separates inspecting a 402 from paying it:

- `make_http_request` — returns the 402 payment requirements (including the
  seller `payTo` and `network`) **without paying**.
- `retry_http_request_with_x402` — **pays**.

This example drops a check in between:

```
make_http_request  →  check_x402_seller  →  retry_http_request_with_x402
```

`check_x402_seller` (in [`meronaGuard.ts`](./meronaGuard.ts)) calls
[merona](https://merona.io)'s free, keyless trust API and returns a recorded-fact
**PASS / FAIL / UNCERTAIN** verdict. The agent is instructed not to pay on a
recorded FAIL, and to ask the user on UNCERTAIN.

merona is an independent x402 settlement index; its verdicts are recomputable
from public on-chain data and it holds no seller relationships. The check is
**fail-soft** — if merona is unreachable it returns UNCERTAIN rather than
throwing, so it never blocks the agent's loop. It uses the published
[`merona-guard`](https://www.npmjs.com/package/merona-guard) package (zero
runtime dependencies) and adds no dependency to agentkit itself.

## Run it

```bash
npm install
export OPENAI_API_KEY=...        # the model
export CDP_API_KEY_ID=...        # CDP wallet
export CDP_API_KEY_SECRET=...
export CDP_WALLET_SECRET=...
export NETWORK_ID=base-sepolia   # or base
npm start
```

Then ask it to fetch a paid x402 URL. On a 402 it will read the requirements,
run `check_x402_seller` on the seller, and only pay if the seller isn't a
recorded FAIL.

> Coverage note: merona's delivery-probe evidence is strongest on Base. On
> networks it doesn't index yet the verdict is UNCERTAIN — which, being
> fail-soft, means "proceed, but I have no evidence either way."

## What this demonstrates

A pre-payment counterparty check is a natural, opt-in extension of the x402 buy
loop. The guard here is provider-agnostic in spirit — `meronaGuard.ts` is ~40
lines and could point at any trust source; it defaults to merona because it's
free and needs no key.
