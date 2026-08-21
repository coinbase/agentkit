# Mycelium Trails — AgentKit Action Provider

> **Disclaimer:** This is an unofficial, community-built AgentKit action provider.
> It is not affiliated with, endorsed by, or submitted upstream to Coinbase AgentKit.
> It performs **read-only** verification against the public Mycelium Trails API.
> It does **not** execute transactions, sign messages, or provide security guarantees.
> Not audited. Use at your own risk.

---

Post-execution reputation layer for AI agents. Each Mycelium Trail is an on-chain record (Base) of a completed agent action — payment, swap, or signed interaction.

Use this provider to verify that an agent actually did what it claims.

## Actions

### `verify_trail`

Check if an agent has a verified trail for a given `action_ref`.

```typescript
const result = await agentkit.run(
  "verify trail for pioneer-agent-001 with action_ref 3ad733..."
);
```

Returns: `{ verified, trail_id, tx_hash, timestamp, service, operation }`

### `compute_action_ref`

Compute the canonical SHA-256 reference from action inputs. Same algorithm as `argentum-sdk`.

```typescript
// SHA-256(agent_id:action_type:scope:timestamp)
const result = await agentkit.run(
  "compute action_ref for pioneer-agent-001, action_type agent_trail, scope giskard-oasis, timestamp 1777991810"
);
```

### `get_trails`

List recent trails for an agent.

```typescript
const result = await agentkit.run("get trails for pioneer-agent-001");
```

## Setup

```bash
npm install
npm run demo   # runs against live Mycelium API, no API key needed
```

## Demo

```bash
npm run demo
```

Output:
```
=== Mycelium Trails AgentKit Provider Demo ===

1. compute_action_ref()
   inputs: { agent_id: 'pioneer-agent-001', action_type: 'agent_trail', ... }
   result: { action_ref: '3ad733...', payload: '...' }
   matches known ref: true

2. verify_trail()
   result: { verified: true, tx_hash: null, timestamp: '2026-05-05T14:36:50+00:00', ... }

3. get_trails()
   count: 11
   latest trail: { service: 'giskard-oasis', operation: 'agent_trail', ... }
```

Live dashboard: https://argentum.rgiskard.xyz/trails/demo

## Integration

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { myceliumTrailsProvider } from "./src";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    myceliumTrailsProvider(),
    // ... other providers
  ],
});
```

## Related

- [Mycelium Trails API](https://argentum.rgiskard.xyz/trails/demo)
- [argentum-sdk](https://github.com/giskard09/argentum-core) — Python SDK with `compute_action_ref`
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — Agent identity standard
