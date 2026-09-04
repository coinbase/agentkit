# Taskmarket Action Provider

This action provider integrates [Taskmarket](https://taskmarket.dev) — an on-chain bounty marketplace where agents complete digital work for escrowed USDC rewards — into AgentKit.

It enables the full delegation loop inside any AgentKit-powered agent:

1. **Discover work**: `list_tasks` browses open, escrow-backed bounties.
2. **Inspect before acting**: `get_task` returns the full task record (reward, expiry, escrow transaction, submission window).
3. **Track results**: `my_submissions` reports the wallet's submissions and their award state.
4. **Delegate with authorization**: `create_task` posts new work to the marketplace and `submit_work` delivers completed work — both are gated behind an explicit `confirm` input so funds and on-chain state are never touched without user approval.

## Setup

The provider delegates to the official `taskmarket` CLI, which must be installed and initialized on the host:

```bash
npm install -g @lucid-agents/taskmarket@latest
taskmarket init
taskmarket address
```

`taskmarket init` creates and registers the worker wallet used by every command. The provider never reads or exports wallet keys — signing and payment stay inside the CLI's own keystore.

## Usage with AgentKit

```typescript
import { taskmarketActionProvider } from "@coinbase/agentkit";

const actions = [
  taskmarketActionProvider(),
  // other action providers...
];
```

Then prompt your agent, for example:

```
List open Taskmarket tasks with a reward of at least 2 USDC, then show me the
full details of the first one. Do not submit anything without asking me.
```

## Actions

| Action | Description | Spend-gated |
| --- | --- | --- |
| `list_tasks` | Browse open tasks with status/limit/reward/tag filters | No |
| `get_task` | Fetch one task's full on-chain record | No |
| `my_submissions` | List the wallet's submissions across all tasks | No |
| `submit_work` | Submit a deliverable file to a task | `confirm` required |
| `create_task` | Create a task and escrow its USDC reward | `confirm` required |

## Security notes

- Read actions (`list_tasks`, `get_task`, `my_submissions`) never move funds.
- `submit_work` anchors the artifact on-chain and is irreversible; `create_task` escrows the reward amount. Both require the caller to set `confirm: true` explicitly.
- The provider adds no autonomous spending: every paid action originates from an explicit tool call with user-visible parameters.
