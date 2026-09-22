# x402 Survival Check — AgentKit Example

An autonomous agent is about to spend USDC on an expensive x402 tool — a research API, a code pack, a facilitator-protected MCP call. Before paying more, it can run a **$0.01 cashier check** against the [Second Eyes Agent Lounge](https://secondeyesai.com) using Coinbase AgentKit on **Base mainnet** over **x402 v2**.

Second Eyes is a live production endpoint. No mock server. No test harness fiction.

**What these services are (and are not):** The endpoints return a **static decision checklist** and fallback guidance for the agent to apply to its own context. They do **not** compute a server-side yes/no verdict, score the task, or inspect the expensive endpoint the agent is about to call. The agent reads the tree and decides.

## The pattern

```
agent plans expensive x402 call
    → unpaid probe (read PAYMENT-REQUIRED)
    → pay $0.01 over x402 v2 (PAYMENT-SIGNATURE → X-PAYMENT)
    → agent applies the returned decision_tree to its own state
    → optionally proceed to the expensive tool
```

The agent:

1. Sends an unpaid request to `GET https://secondeyesai.com/api/bar/x402/help-me` → receives **HTTP 402 PAYMENT-REQUIRED**
2. Inspects the `accepts[]` payment requirements (scheme `ExactEvmScheme`, network `eip155:8453`, USDC on Base, amount $0.01)
3. Signs and pays autonomously from its **CDP wallet** via **x402 v2** (the client emits `PAYMENT-SIGNATURE` / `X-PAYMENT`)
4. Retries with payment proof → receives the guidance pack + settlement receipt (`payment-response` header)

`help-me` is the **canonical sessionless distress door** — no lounge session header is required. The agent can optionally buy `should-i-pay` first as a pre-payment checklist (also sessionless, also $0.01).

## Endpoints

| Endpoint                         | Purpose                             | Session | Price |
| -------------------------------- | ----------------------------------- | ------- | ----- |
| `GET /api/bar/x402/help-me`      | Canonical sessionless distress door | none    | $0.01 |
| `GET /api/bar/x402/should-i-pay` | Optional pre-payment checklist      | none    | $0.01 |

Session-scoped routes (`/api/bar/services/*`) still exist for stateful lounge flows, but they are **not** required for this example and are intentionally not used here.

## x402 v2 protocol notes

- **Version:** x402 **v2**. The challenge is **HTTP 402 PAYMENT-REQUIRED**; the client returns the signed authorization as **`PAYMENT-SIGNATURE`** / **`X-PAYMENT`**; settlement proof comes back on the **`payment-response`** header (v1 used `x-payment-response`).
- **Scheme:** `ExactEvmScheme` (EIP-3009 `transferWithAuthorization` for USDC).
- **Network:** Base mainnet, CAIP-2 **`eip155:8453`** — the only network currently active for Second Eyes settlement.
- **Asset:** native Base **USDC**.
- **Planned (not active):** Polygon and Solana settlement are on the roadmap but are **not** live yet; do not configure them against this endpoint today.

## What a paid call returns on HTTP 200

After payment, the JSON body includes the **guidance pack** plus settlement fields. Representative shape:

```json
{
  "service": "help-me",
  "pack_type": "cashier",
  "decision_tree": [
    "Did proof pass?",
    "Is a free sample sufficient for this task?",
    "Will a one-time nano/micro unblock faster than a tool pack?",
    "Is a bar tab cheaper for 3+ fetches this session?"
  ],
  "default": "If uncertain, run a price check then proof before the next 402.",
  "access": "granted",
  "scope": "lounge",
  "paid_usd": 0.01,
  "grantId": "agr_…",
  "receipt": {
    "success": true,
    "transaction": "0x…",
    "network": "eip155:8453",
    "payer": "0x…"
  },
  "note": "Paid survival service. Embed work_stamp in your deliverable. Save the receipt."
}
```

**How to use it:** Walk the `decision_tree` against the agent's session state (proof status, free samples tried, expected fetch count). If still uncertain, follow `default` before committing to a larger 402.

Public proof ledger: `https://secondeyesai.com/api/bar/proof/payments`

Agent discovery: `https://secondeyesai.com/.well-known/agent-card.json`

## Prerequisites

### Node.js

Node.js **20+** required.

```bash
node --version
```

### Coinbase Developer Platform

- [CDP API Key](https://portal.cdp.coinbase.com/access/api) (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`)
- [Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api) (`CDP_WALLET_SECRET`)
- **USDC on Base mainnet** in the CDP wallet (~$0.05 covers several $0.01 runs plus gas)

No Second Eyes API key is required — the lounge is a public x402 endpoint.

## Setup

From the **typescript workspace root**:

```bash
pnpm install
pnpm build
```

Copy environment template:

```bash
cd examples/x402-survival-check
cp .env.example .env
```

Fill in CDP credentials. Run once to create a wallet:

```bash
pnpm start
```

Note the printed wallet address, fund it with Base USDC, then add to `.env`:

```
ADDRESS=0x...
NETWORK_ID=base-mainnet
```

## Run

```bash
pnpm start
```

To also buy the optional `should-i-pay` checklist before `help-me`:

```bash
RUN_SHOULD_I_PAY=1 pnpm start
```

Expected output:

1. Wallet address + network
2. Unpaid probe → HTTP 402 with decoded `accepts[]` (scheme / network / amount)
3. Paid call → HTTP 200 with `grantId`, `receipt.transaction`
4. BaseScan link for the settlement tx

## How it maps to AgentKit

This example uses **`CdpEvmWalletProvider`** (AgentKit's CDP wallet on Base) as the x402 signer. Payment handling uses the **x402 v2** client from `@x402/fetch` (`x402Client` + `wrapFetchWithPayment`) with the exact EVM scheme registered via `registerExactEvmScheme` from `@x402/evm` — the same building blocks AgentKit's `x402ActionProvider` uses internally.

For LangChain agents with tool loops, wire the same flow through `x402ActionProvider` and register `https://secondeyesai.com` in `registeredServices`. This script is the minimal vertical slice: wallet → unpaid 402 probe → pay → receipt.

**MCP-native agents:** The same pay → receipt flow is available via [`@secondeyes/mcp-unblock@1.2.3`](https://www.npmjs.com/package/@secondeyes/mcp-unblock/v/1.2.3) — `enter_lounge` then `order_service` with slug `help-me` (or `should-i-pay`), requiring `MCP_X402_WALLET_KEY` on the MCP server process:

```json
{
  "mcpServers": {
    "secondeye-unblock": {
      "command": "npx",
      "args": ["-y", "@secondeyes/mcp-unblock@1.2.3"]
    }
  }
}
```

## Resources

- Second Eyes: https://secondeyesai.com
- Agent card: https://secondeyesai.com/.well-known/agent-card.json
- Pricing: https://secondeyesai.com/api/bar/pricing
- x402 overview: https://docs.cdp.coinbase.com/x402/overview
- AgentKit: https://github.com/coinbase/agentkit

## License

[Apache-2.0](../../../LICENSE.md)
