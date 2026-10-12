# X402station Action Provider

The `x402station` action provider gives any AgentKit agent a pre-flight oracle for x402 endpoints. Four paid tools (`preflight`, `forensics`, `catalog_decoys`, `watch_subscribe`) auto-sign their own $0.001–$0.01 USDC payments through the agent's configured `EvmWalletProvider`; two free secret-gated tools (`watch_status`, `watch_unsubscribe`) manage an existing webhook subscription.

This is a wrapper around the public oracle at [x402station.io](https://x402station.io) — same API + identical signal vocabulary used by the official `x402station-mcp` package on npm.

## Why pre-flight?

The agentic.market catalog has 25,000+ x402 endpoints. A non-trivial fraction are honeypots:

- **Decoys** priced ≥ $1,000 USDC per call. An agent that pays one drains its wallet.
- **Zombies** that 402-handshake fine but always 4xx after settlement (the call-side payment goes through, the agent gets nothing).
- **Dead** endpoints that return network errors or 5xx every probe.
- **Price-jacked** endpoints whose listed price drifted 10× past the provider's group median.

x402station independently probes every endpoint every ~10 minutes (not facilitator-reported) so it catches what facilitator-only monitors miss. Calling `preflight` before each paid x402 request costs $0.001 — typically 20× cheaper than the request the agent would otherwise lose to a decoy.

## Networks

- Base mainnet (`base-mainnet` / `eip155:8453`) — production
- Base Sepolia (`base-sepolia` / `eip155:84532`) — testing

The oracle accepts USDC payments on both networks via Coinbase's CDP facilitator; the action provider's `supportsNetwork` returns `false` for any other network.

## Actions

| Action | Cost | Description |
|---|---|---|
| `preflight` | $0.001 | `{ok, warnings[], metadata}` for any URL — fast safety check |
| `forensics` | $0.001 | 7-day uptime + latency p50/p90/p99 + decoy probability + concentration stats |
| `catalog_decoys` | $0.005 | Every URL flagged dangerous, in one cacheable blob |
| `watch_subscribe` | $0.01 | 30-day webhook subscription + 100 prepaid HMAC-signed alerts |
| `watch_status` | free* | Read-back: active/expired, alerts remaining, recent deliveries |
| `watch_unsubscribe` | free* | Soft-delete a watch |

\* Free actions are secret-gated by the 64-char hex secret returned from `watch_subscribe`. Constant-time compare on the server; mismatched secret returns 404 (not 401) so an attacker scraping IDs can't distinguish "exists but wrong secret" from "doesn't exist".

## Signal vocabulary

Strings returned in `warnings[]` from `preflight` / `forensics`. **Bold** signals flip `ok` to `false` and an agent should refuse the target call:

- **`dead`** — ≥3 unhealthy probes in the last 30 min
- **`zombie`** — ≥3 probes in the last hour, zero healthy
- **`decoy_price_extreme`** — listed price ≥ $1,000 USDC
- **`dead_7d`** — ≥20 probes over 7 days, zero healthy (forensics-only)
- **`mostly_dead`** — ≥20 probes over 7 days, uptime < 50% (forensics-only)
- `unknown_endpoint` — URL not in the catalog (informational; still billed)
- `no_history` — in catalog but no probes in the last hour
- `suspicious_high_price` — price $10–$1,000 USDC
- `slow` — avg latency ≥ 2,000 ms in the last hour
- `new_provider` — service first seen < 24h ago
- `slow_p99` — latency p99 ≥ 5,000 ms (forensics-only)
- `price_outlier_high` — current price > 10× provider-group median
- `high_concentration` — endpoint's provider owns ≥ 5% of the catalog

The watch endpoint accepts a subset of these in its `signals` array — the worker fires when subscribed signals appear or clear vs the last computed state.

## Example

```typescript
import {
  AgentKit,
  CdpEvmServerWalletProvider,
  x402stationActionProvider,
} from "@coinbase/agentkit";

const walletProvider = await CdpEvmServerWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
  walletSecret: process.env.CDP_WALLET_SECRET!,
  networkId: "base-mainnet",
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [x402stationActionProvider()],
});

// The LLM can now call preflight, forensics, etc. via getActions().
// Pre-flight a target before the agent commits a paid call to it:
const actions = agentKit.getActions();
const preflight = actions.find((a) => a.name.endsWith("_preflight"))!;
const result = await preflight.invoke({
  url: "https://api.venice.ai/api/v1/chat/completions",
});
console.log(JSON.parse(result));
//   { result: { ok: false, warnings: ["dead", "zombie"], metadata: {...} },
//     paymentReceipt: { transaction: "0x…" } }
```

## Configuration

```typescript
x402stationActionProvider({
  // Defaults to https://x402station.io. Only the canonical host or a
  // localhost dev URL is accepted — refuses to start otherwise so a
  // misconfigured agent can't sign x402 payments against an unknown host.
  baseUrl: "https://x402station.io",
});
```

## Links

- Service: <https://x402station.io>
- Manifest: <https://x402station.io/.well-known/x402>
- OpenAPI: <https://x402station.io/api/openapi.json>
- Agent skills (v0.2.0): <https://x402station.io/.well-known/agent-skills>
- Skill description: <https://x402station.io/skill.md>
- Source: <https://github.com/sF1nX/x402station>
- npm (MCP adapter for non-AgentKit agents): <https://www.npmjs.com/package/x402station-mcp>
