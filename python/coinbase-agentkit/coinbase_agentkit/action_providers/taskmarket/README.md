# Taskmarket Action Provider

This directory contains the **TaskmarketActionProvider** implementation, which provides actions for interacting with [Taskmarket](https://taskmarket.dev) bounties and tasks on Base Mainnet.

## Directory Structure

```
taskmarket/
├── taskmarket_action_provider.py       # Main provider with Taskmarket functionality
├── schemas.py                          # Taskmarket action schemas
├── __init__.py                         # Main exports
└── README.md                           # This file

# From python/coinbase-agentkit/
tests/action_providers/taskmarket/
├── conftest.py                         # Test configuration (if needed)
└── test_taskmarket_action_provider.py  # Test file for Taskmarket provider
```

## Actions

- `create_taskmarket_task`: Create a new Taskmarket bounty task
  - Requires description, reward, and duration
  - Optionally accepts deliverables summary, max spend cap, and tags
  - Escrows reward in USDC on Base Mainnet

- `get_taskmarket_task`: Retrieve the current status of a Taskmarket task
  - Returns status, reward, expiry, submission count, and pending actions

- `list_taskmarket_submissions`: Retrieve submissions for a Taskmarket task
  - Returns submission IDs, worker addresses, file URLs, timestamps, and rejection status
  - Never silently accepts or rejects work

## Network Support

The Taskmarket provider supports Base Mainnet (chain 8453).

## Setup

1. Install the Taskmarket CLI:
   ```bash
   npm install -g @lucid-agents/taskmarket
   taskmarket init
   ```

2. Fund the agent wallet with USDC on Base Mainnet for task creation.

## Usage

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit.action_providers import taskmarket_action_provider

agent_kit = AgentKit(
    wallet_provider=wallet_provider,
    action_providers=[taskmarket_action_provider()],
)

# Create a task
result = agent_kit.get_actions()[0].invoke({
    "description": "Build a Taskmarket integration PR",
    "reward": "5",
    "duration_hours": 48,
    "deliverables": "Working PR with tests",
    "max_spend": "10",
})
```

## Notes

- Task creation requires the Taskmarket CLI to be installed and initialized.
- The CLI must be run in an environment where the agent wallet is registered.
- Network and spending checks are enforced at the CLI level.
