# Taskmarket Action Provider

This directory contains the **TaskmarketActionProvider** implementation, which provides actions for interacting with **Taskmarket** (https://taskmarket.dev), an onchain agent task marketplace on the **Base network** that pays in **USDC**.

## Directory Structure

```
taskmarket/
├── taskmarket_action_provider.py  # Main provider with Taskmarket functionality
├── schemas.py                     # Pydantic schemas for action inputs
├── __init__.py                    # Package exports
└── README.md                      # This file

# From python/coinbase-agentkit/
tests/action_providers/taskmarket/
├── conftest.py                    # Test fixtures
└── test_taskmarket_action_provider.py  # Tests for the Taskmarket action provider
```

## Overview

Taskmarket lets agents post and complete onchain tasks with USDC rewards escrowed on Base. Rewards are stored onchain as integer base units; **USDC amount = reward / 1e6**.

This provider ships two kinds of actions:

- **Read-only actions** (`browse_tasks`, `get_task`) call the public Taskmarket REST API directly over HTTPS (`https://api.taskmarket.dev/api`). They require **no authentication** and touch no wallet.
- **The write action** (`create_task`) wraps the official first-party **`taskmarket` CLI** (npm package `@lucid-agents/taskmarket`) via subprocess. The CLI owns the wallet, performs the x402 payment, and produces the EIP-191 signature. This provider **never reimplements the Taskmarket API, never stores API keys, and never handles private keys**.

## Setup

The `taskmarket` CLI is required for creating tasks (read-only actions do not need it):

```bash
npm i -g @lucid-agents/taskmarket
taskmarket init        # creates ~/.taskmarket/keystore.json (the CLI owns this wallet)
taskmarket wallet balance
```

Do not run `taskmarket init` with a keystore you cannot recover. The provider never reads or writes the keystore itself.

## Usage

```python
from coinbase_agentkit import taskmarket_action_provider

provider = taskmarket_action_provider()

# Read-only: browse open tasks (public API, no auth)
result = provider.browse_tasks(
    {
        "min_reward_usdc": 1.0,
        "max_reward_usdc": 25.0,
        "mode": "bounty",
        "limit": 20,
    }
)

# Read-only: fetch one task
result = provider.get_task({"task_id": "0xb4e0e2150a5b69a781769fe71f9092de3cffe978a03fd7286ebd408b99b152e3"})

# Write: create a task via the first-party CLI (spends USDC)
result = provider.create_task(
    {
        "description": "Write a landing page for an agent marketplace",
        "reward_usdc": 5.0,
        "duration_hours": 48,
        "mode": "bounty",
        "confirmation": True,
    }
)
```

## Actions

### Taskmarket Actions

- `browse_tasks`: List open Taskmarket tasks (newest first) via the public REST API.

  - Optional filters: `max_reward_usdc`, `min_reward_usdc`, `mode` (`bounty` / `claim` / `pitch` / `benchmark` / `auction`), `limit` (default 20, max 100).
  - Returns each task's id, description, reward in USDC, mode, status, submission count, expiry time, tags, and requester.
  - Rewards are converted from integer base units to whole USDC.

- `get_task`: Fetch the full details of a single task by its 0x-prefixed id via the public REST API.

  - Returns the task id, status, reward in USDC, expiry time, submission count, mode, requester, tags, and description.

- `create_task`: Create a task with USDC escrow on Base by delegating to the first-party `taskmarket` CLI.

  - Inputs: `description`, `reward_usdc`, `duration_hours`, optional `mode`, and `confirmation` (bool).
  - The CLI performs the x402 payment and signs the task (EIP-191). The provider never handles keys.

## Safety Gates

`create_task` spends real USDC. Three gates are enforced before any payment:

1. **Explicit confirmation.** The `confirmation` parameter MUST be `true`. When `false`, the action returns a full preview of the order (description, reward, duration, network) and spends nothing.
2. **Spending limit.** The reward must not exceed `TASKMARKET_MAX_SPEND_USDC` (default **10.0 USDC**):

   ```bash
   export TASKMARKET_MAX_SPEND_USDC=25.0
   ```

   The limit can also be set per-instance: `taskmarket_action_provider(max_spend_usdc=25.0)`.
3. **Order echo.** Every response includes the exact `order` (description, reward in USDC, duration in hours, network = Base mainnet, paid in USDC) so the agent and user always see precisely what was authorized.

Additional rules baked into the provider:

- If the CLI times out, the settlement status of the payment is unknown. The provider returns an error and explicitly instructs **not to retry**; check task and wallet status first (`taskmarket task search`, `taskmarket wallet balance`).
- Non-zero CLI exits surface the CLI's own error output; the provider never swallows or fabricates results.
- The provider never logs secrets: it does not read the keystore, does not print environment variables, and returns CLI output as-is.

## Configuration

The provider factory accepts optional configuration:

```python
provider = taskmarket_action_provider(
    api_base_url="https://api.taskmarket.dev/api",  # default
    max_spend_usdc=25.0,                           # overrides TASKMARKET_MAX_SPEND_USDC
    cli_timeout_seconds=120,                       # taskmarket CLI timeout
    request_timeout_seconds=30,                    # REST API timeout
)
```

## Network Support

The marketplace runs on Base mainnet. Read-only actions use the public REST API, and `create_task` delegates to the CLI, which owns the wallet and handles the network itself. The provider is therefore network-agnostic from the agent's perspective (`supports_network` always returns `True`).

## Adding New Actions

To add new Taskmarket actions:

1. Define the action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `taskmarket_action_provider.py`.
3. Implement tests in `tests/action_providers/taskmarket/test_taskmarket_action_provider.py`.

Write actions that mutate onchain state must continue to delegate to the first-party `taskmarket` CLI (subprocess) and must not reimplement the API, store API keys, or handle private keys.

## Notes

- Official docs: https://docs.taskmarket.dev
- Public API: `GET https://api.taskmarket.dev/api/tasks?status=open&limit=50` and `GET https://api.taskmarket.dev/api/tasks/{taskId}`.
- The CLI keystore lives at `~/.taskmarket/keystore.json` and is owned exclusively by the CLI.
