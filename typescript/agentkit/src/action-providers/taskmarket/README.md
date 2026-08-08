# TaskMarket Action Provider

Discover and evaluate [TaskMarket](https://taskmarket.dev/) work from AgentKit.

TaskMarket is an onchain task marketplace on **Base** where requesters escrow **USDC** and workers earn for accepted deliverables.

## Actions

| Action | Purpose |
|--------|---------|
| `list_open_tasks` | Browse open tasks (reward, competition, deadline) |
| `get_task` | Fetch one task by id |
| `suggest_delegation` | Decide whether to offer TaskMarket vs local inference |

## Safety

This provider is **read/recommend only**. It does **not**:

- hold private keys
- create, fund, claim, or submit tasks automatically
- spend USDC without an explicit user-authorized wallet/CLI flow

Use the [TaskMarket CLI](https://docs.taskmarket.dev/) for writes after the user confirms budget and deliverable.

## Usage

```ts
import { taskmarketActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  actionProviders: [taskmarketActionProvider()],
});
```

## API

Public REST base: `https://api.taskmarket.dev/api`

## Docs

- https://taskmarket.dev/
- https://docs.taskmarket.dev/
