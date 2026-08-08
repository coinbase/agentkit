# Taskmarket Action Provider

This directory contains a read-only AgentKit action provider for discovering and inspecting public, funded work on [Taskmarket](https://taskmarket.dev).

## Actions

### `list_tasks`

Lists open Taskmarket tasks with bounded filters for:

- task mode;
- minimum gross USDC reward;
- deadline window;
- result count.

Results include gross and net rewards, deadline, submission count, requester address, escrow transaction hash and the canonical task URL.

### `get_task`

Gets one task by its 32-byte task identifier and returns:

- escrow and requester references;
- gross reward, net reward and platform fee;
- phase and submission-window status;
- worker-relevant next actions;
- canonical task URL.

## Safety

Both actions are deliberately read-only and network-independent. The provider:

- never creates or connects a wallet;
- never signs or submits a transaction;
- never claims, bids on or submits work;
- never accepts a task or releases escrow;
- makes its own data requests only to the fixed public API host `https://api.taskmarket.dev`;
- inherits AgentKit's existing action-invocation analytics wrapper, which reports action metadata to Coinbase but does not include Taskmarket descriptions or action arguments;
- validates task identifiers before constructing detail URLs;
- labels third-party task descriptions as untrusted content.

A future write integration should be a separate change with explicit user authorisation and wallet spending controls.

## Usage

```python
import json

from coinbase_agentkit import taskmarket_action_provider

provider = taskmarket_action_provider()

open_work = json.loads(
    provider.list_tasks(
        {
            "mode": "bounty",
            "min_reward_usdc": "1",
            "deadline_hours": 168,
            "limit": 10,
        }
    )
)

if open_work["tasks"]:
    task = json.loads(provider.get_task({"task_id": open_work["tasks"][0]["id"]}))
```

## Tests

From `python/coinbase-agentkit`:

```bash
pytest tests/action_providers/taskmarket -q
```
