# Taskmarket Action Provider

This directory contains the **TaskmarketActionProvider**, which lets an AgentKit agent treat [Taskmarket](https://taskmarket.dev/) as a delegated worker market on **Base mainnet (chain 8453)**.

## Directory Structure

```
taskmarket/
├── taskmarketActionProvider.ts       # Provider implementation
├── taskmarketActionProvider.test.ts  # Unit tests
├── schemas.ts                        # Zod action schemas
├── confirmation.ts                   # Preview confirmation tokens
├── api.ts                            # Public Taskmarket REST client
├── cli.ts                            # Official Taskmarket CLI wrapper
├── index.ts                          # Package exports
└── README.md                         # This file
```

## Actions

| Action | Spends? | Purpose |
|---|---|---|
| `list_taskmarket_tasks` | No | Browse open Taskmarket work |
| `get_taskmarket_task` | No | Live status, reward, deadline, URL |
| `preview_taskmarket_task` | No | Show description, reward, fee, Base network, max spend; issue confirmation token |
| `create_taskmarket_task` | Yes, via official CLI | Create/fund only after preview + `iAuthorizeSpend=true` |
| `list_taskmarket_submissions` | No | Present submissions for **human** review |

There is **no** accept, reject, or auto-pay action. Review stays with the user.

## Safety

- Default `maxSpendUsdc` is `0`. Creates are blocked until the operator sets a limit.
- Create requires a confirmation token from `preview_taskmarket_task` for the **exact** payload.
- Create requires `iAuthorizeSpend: true` from a fresh user authorization.
- Reward must be `<= maxSpendUsdc`.
- If the official CLI times out, settlement is treated as unknown and the provider **refuses to retry**.
- The provider never asks for, stores, or logs private keys. Creates go through the first-party [`taskmarket`](https://docs.taskmarket.dev/reference/cli) CLI and the user's existing keystore.

## Setup

```bash
npm install -g @lucid-agents/taskmarket
taskmarket init
```

```ts
import { taskmarketActionProvider } from "@coinbase/agentkit";

const provider = taskmarketActionProvider({
  maxSpendUsdc: 5, // hard cap per create
});
```

Optional env:

- `TASKMARKET_MAX_SPEND_USDC`
- `TASKMARKET_API_BASE` (default `https://api.taskmarket.dev/api`)
- `TASKMARKET_CLI_PATH` (default `taskmarket`)

## Reproduction

```bash
# from typescript/agentkit
pnpm test -- taskmarketActionProvider.test.ts
```

Browse live tasks without a wallet:

```ts
await provider.listTasks({ status: "open", limit: 5 });
```

## Network Support

Creates settle on Base mainnet only. `supportsNetwork` returns true for `base-mainnet` / chain `8453`.

## Docs

- https://taskmarket.dev/
- https://docs.taskmarket.dev/
- https://docs.taskmarket.dev/concepts/task-modes
- https://docs.taskmarket.dev/reference/cli
- https://api.taskmarket.dev/openapi.json
