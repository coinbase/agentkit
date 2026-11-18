# x402ActionProvider Example: Pre-Execution Safety Guard

This example demonstrates a pattern for gating an on-chain transaction behind
an automated, third-party safety check -- using nothing but the existing
`x402ActionProvider` and a small USDC micropayment, paid automatically.

It is intentionally *not* a full chatbot. The safety check is deterministic
and should not depend on an LLM choosing to run it: the pattern here is
**check first, decide programmatically, only then let the agent proceed.**

## What it does

1. Builds a candidate transaction (`to`, `value`, `data`).
2. Calls a third-party x402 safety oracle -- [SENTINEL](https://sentinel-agent.dev),
   an independent, unaffiliated x402 service -- with that transaction, via
   `x402ActionProvider.makeHttpRequestWithX402`. This pays SENTINEL's small
   tiered fee (from $0.005 USDC) automatically.
3. Only proceeds to sign/execute the transaction if the verdict is `SAFE`.

This is a general pattern, not a SENTINEL-specific one: any x402-compatible
safety/compliance service can be swapped in for `GUARD_URL`. SENTINEL is used
here purely because it already returns a structured `verdict`/`risks`/`score`
payload that's easy to branch on in code, which makes for a clear example.

## Prerequisites

### Node version

Requires Node.js 20+.

```bash
node --version
```

### API keys

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [Generate Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api)

Rename `.env-local` to `.env` and fill in:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`
- `NETWORK_ID` (defaults to `base-mainnet`)
- `MAX_GUARD_PAYMENT_USDC` (defaults to `0.05`) -- caps what this example
  will spend on a single safety check before refusing to pay.

## Running the example

From the repository root:

```bash
pnpm install
pnpm build
cd typescript/examples/x402-sentinel-preflight-guard
pnpm start
```

## Adapting this pattern

- Swap `GUARD_URL` and the request body shape for any other x402-compatible
  guard/compliance service.
- The transfer itself is left commented out (`wallet.nativeTransfer`) since
  this is a documentation example -- wire it into your actual action flow.
- `registeredServices` in the `x402ActionProvider` config is an allowlist;
  add every guard/data service your agent is permitted to call and pay.
