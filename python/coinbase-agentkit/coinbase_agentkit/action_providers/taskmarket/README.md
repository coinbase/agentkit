# TaskMarket Action Provider

This directory contains the **TaskMarketActionProvider**, a safe delegation helper for discovering public TaskMarket work and preparing auditable TaskMarket task drafts from AgentKit-powered agents.

The provider is intentionally **no-spend by default**. It can browse public tasks and prepare a structured draft, but it does not create, fund, or accept TaskMarket tasks. Host applications must present the draft to the user and obtain explicit approval before connecting any wallet, payment, or task-creation flow.

## Directory Structure

```text
taskmarket/
├── taskmarket_action_provider.py  # Main provider implementation
├── schemas.py                     # Pydantic schemas for provider actions
├── __init__.py                    # Provider exports
└── README.md                      # This file
```

## Configuration

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit.action_providers.taskmarket import taskmarket_action_provider

agentkit = AgentKit(
    wallet_provider=wallet_provider,
    action_providers=[taskmarket_action_provider()],
)
```

For tests, self-hosted deployments, or API gateways, pass a custom API base URL:

```python
provider = taskmarket_action_provider(api_url="https://api.taskmarket.dev")
```

## Actions

### `browse_taskmarket_tasks`

Browse public TaskMarket tasks without spending funds.

Example input:

```json
{
  "limit": 10,
  "tag": "ai",
  "max_submissions": 20
}
```

Example response shape:

```json
{
  "success": true,
  "tasks": [
    {
      "id": "0x...",
      "title": "Create a reproducible benchmark...",
      "mode": "bounty",
      "status": "open",
      "netReward": "925000",
      "submissionCount": 12,
      "awardCount": 0,
      "tags": ["agents", "benchmark"],
      "submissionWindowOpen": true
    }
  ],
  "returned": 1,
  "safety": "read_only_no_spend"
}
```

### `prepare_taskmarket_task_draft`

Prepare a structured delegation draft for user review. This action does **not** create or fund a task.

Example input:

```json
{
  "title": "Audit a Python CLI release candidate",
  "deliverable": "Review the repository diff, run the documented test suite, and return a concise bug report with reproduction commands.",
  "acceptance_criteria": [
    "Includes exact commit tested",
    "Includes commands run and outputs",
    "Separates confirmed bugs from suggestions"
  ],
  "max_budget_usdc": 5,
  "deadline_iso": "2026-08-15T18:00:00Z",
  "requires_human_approval": true
}
```

Example response shape:

```json
{
  "success": true,
  "draft": {
    "title": "Audit a Python CLI release candidate",
    "deliverable": "Review the repository diff...",
    "acceptance_criteria": ["Includes exact commit tested"],
    "max_budget_usdc": 5.0,
    "deadline_iso": "2026-08-15T18:00:00Z",
    "requires_human_approval": true
  },
  "nextStep": "Present this draft to the user for explicit approval before creating or funding a TaskMarket task.",
  "safety": {
    "spendsFunds": false,
    "createsTask": false,
    "requiresExplicitApproval": true
  }
}
```

## Safety Model

- Read-only browsing does not require a wallet signature.
- Draft preparation does not create a TaskMarket task.
- `requires_human_approval` must remain `true` for generated drafts.
- The provider never spends funds, exposes private keys, bypasses wallet permissions, or auto-accepts worker submissions.
- Any future create/fund/accept action should live behind explicit host-application policy, user confirmation, and spending limits.

## Tests

Run the targeted Python tests from the `python/coinbase-agentkit` directory:

```bash
.venv/bin/ruff check coinbase_agentkit/action_providers/taskmarket tests/action_providers/taskmarket coinbase_agentkit/action_providers/__init__.py
.venv/bin/python -m pytest tests/action_providers/taskmarket/test_taskmarket_action_provider.py -q
```
