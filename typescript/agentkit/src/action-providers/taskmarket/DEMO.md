# Taskmarket Action Provider — Demo Log

Recorded 2026-08-13T23:15Z from the same public API the provider calls (`https://api.taskmarket.dev/api`).

## 1. Browse open tasks (`list_taskmarket_tasks`)

```
GET https://api.taskmarket.dev/api/tasks?status=open&limit=3
```

Returned 3 open bounties, including:

| id prefix | mode | status | reward (base units) |
|---|---|---|---|
| `0xdf65bccc07b3681f` | bounty | open | 8000 (0.008 USDC) |
| `0xfb182f610d57a6c0` | bounty | open | 398000 (0.398 USDC) |
| `0xf41d2979b5765bda` | bounty | open | 100000000 (100 USDC) |

No wallet, key, or spend involved.

## 2. Live status (`get_taskmarket_task`)

```
GET https://api.taskmarket.dev/api/tasks/0xdf65bccc07b3681f4028a45bfb31e2ce49f311c1e549e7a80be6d21915b84e4c
```

Response included `id`, `status=open`, `reward`, `expiryTime`, `tags`, `mode`. Public URL:

https://taskmarket.dev/tasks/0xdf65bccc07b3681f4028a45bfb31e2ce49f311c1e549e7a80be6d21915b84e4c

## 3. Preview then create (authorization)

`preview_taskmarket_task` returns the full spend preview (description, deliverables, reward, 7.5% platform fee, Base / chain 8453, max spend) plus a confirmation token. `create_taskmarket_task` is refused unless:

- `iAuthorizeSpend === true`
- the token matches the exact payload
- `rewardUsdc <= maxSpendUsdc`
- a previous create is not sitting in unknown-settlement

Covered by `taskmarketActionProvider.test.ts`.

## 4. Submissions stay human-reviewed

`list_taskmarket_submissions` returns `{ reviewOnly: true, autoAccept: false, autoReject: false }`. There is no accept/reject action on this provider.
