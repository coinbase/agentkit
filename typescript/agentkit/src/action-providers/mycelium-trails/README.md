# Mycelium Trails — AgentKit Action Provider

> **Disclaimer:** This is an unofficial, community-built AgentKit action provider.
> It is not affiliated with or endorsed by Coinbase.
> It performs **read-only** lookups against the public Mycelium Trails API.
> It does **not** execute transactions, sign messages, or provide security guarantees.
> Not audited. Use at your own risk.

---

A Mycelium Trail is a record of an action an agent reported, with an `action_ref` derived from the action's inputs. A trail may be anchored on-chain; when it is, `tx_hash` is the anchoring transaction.

`agent_id` is declared by whoever recorded the trail, and a trail is not proof that the action happened. Use this provider to look trails up, not to confirm that an action took place.

## Actions

### `verify_trail`

Check whether a trail exists for an `agent_id` and an `action_ref`.

```typescript
const result = await agentkit.run(
  "verify trail for pioneer-agent-001 with action_ref 689ebc4c..."
);
```

Returns what `GET /trails/verify` returns: `{ verified, trail }`, where `trail` holds `trail_id`, `service`, `operation`, `action_ref`, `timestamp` (Unix seconds), `success`, `tx_hash` (if anchored) and the other trail fields. `trail` is absent when `verified` is false.

### `compute_action_ref`

Compute the action_ref (v1) from action inputs: `SHA-256(JCS({agent_id, action_type, scope, timestamp}))`, RFC 8785.

```typescript
const result = await agentkit.run(
  'compute action_ref for giskard-self, action_type trail.anchor, scope mycelium:baseline, timestamp "2026-05-23T00:00:00.000Z"'
);
// { action_ref: "f4ebda732e3c063bdd8547c734e4956f009bbed7f557cb949f7c8033e8c42d1d", canonical: "{...}" }
```

The timestamp is a string, exactly `YYYY-MM-DDTHH:MM:SS.mmmZ`. `agent_id`, `action_type` and `scope` must be ASCII and `scope` must not be empty. An input outside that domain returns `{ "error": "OUT_OF_PROFILE_DOMAIN", "field": ..., "reason": ... }` instead of a hash.

### `get_trails`

List recent trails for an agent.

```typescript
const result = await agentkit.run("get trails for pioneer-agent-001");
```

## Integration

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { myceliumTrailsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    myceliumTrailsActionProvider(),
    // ... other providers
  ],
});
```

## Related

- [Mycelium Trails API](https://argentum.rgiskard.xyz/trails/demo)
- [action_ref spec](https://github.com/giskard09/argentum-core/blob/main/docs/spec/action-ref.md) — v1 derivation and Domain rules
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — Agent identity standard
