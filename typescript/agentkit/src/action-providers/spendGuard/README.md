# SpendGuardActionProvider

Gives an AgentKit agent a spend and limit firewall. The agent sends one batch of
limit operations and the guard answers whether the whole batch fits **before**
anything happens. The batch is atomic: applied completely or not at all.

## Configuration

| variable | default | meaning |
|---|---|---|
| `SPEND_GUARD_URL` | `https://zealous-unburned-tameness.ngrok-free.dev` | base URL of the guard |

The guard is an HTTP contract, not a vendor lock: any server that answers
`POST {url}/v1/guard` with `{ "orders": [...] }` and the JSON shape below works.
Pass a URL to the factory to override the environment variable.

## Usage

```ts
import { AgentKit, SpendGuardActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [new SpendGuardActionProvider()],
});
```

## Action: `guard_batch`

Input:

```json
{
  "orders": [
    { "root": "BUDGET.USD", "action": "SET", "value_dec": 50 },
    { "root": "BUDGET.USD", "action": "INCREASE", "value_dec": 12 },
    { "root": "DB.WRITE", "action": "INCREASE", "value": 5 }
  ],
  "tenant": 0
}
```

Roots: `BUDGET.USD`, `API.RATE`, `DB.WRITE`, `TRANSFER.LIMIT`, `TOKEN.BURN`,
`QUEUE.BATCH`, `RETRY.LOOP`, `SESSION.LOCK`.
Actions: `READ`, `SET`, `INCREASE`, `DECREASE`, `OPEN`, `CLOSE`, `STOP`.
`value` is in the limit's own scale (`BUDGET.USD` scale 100: 73.50 -> 7350);
`value_dec` is the human unit. `lock: true` trips the tenant's circuit breaker
when the order violates a limit.

Output:

```json
{"ok": true,  "codes": "0", "values": {"BUDGET.USD": 6200}, "latched": false}
{"ok": false, "codes": "M", "values": {"BUDGET.USD": 5000}, "latched": false}
```

`M` = blocked by a limit, nothing applied. `T` = safety lock, `L` = tenant locked.

The first 5 actions of a batch are free. Larger batches answer HTTP 402; the
action returns the challenge so it can be paid with the x402 provider and retried.
