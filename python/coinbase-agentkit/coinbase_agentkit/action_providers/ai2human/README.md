# AI2Human Action Provider

Dispatch reality-bound human-execution tasks with proof verification.

When your onchain agent hits a step it can't complete alone — local verification, physical checks, identity-bound actions, compliance reviews — AI2Human dispatches it to a human operator with cryptographic proof verification and USDC settlement.

## Directory Structure

```
ai2human/
├── ai2human_action_provider.py    # AI2Human action provider
├── schemas.py                     # Action schemas
├── __init__.py                    # Main exports
└── README.md                      # This file
```

## Actions

- `ai2human_create_task`: Dispatch a human-execution task
- `ai2human_check_task`: Check task status, proof verification, and settlement
- `ai2human_get_proof`: Retrieve evidence bundle and settlement receipt
- `ai2human_list_categories`: List supported task categories and proof types

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, ai2human_action_provider

agent_kit = AgentKit(AgentKitConfig(
    action_providers=[ai2human_action_provider()],
))
```

Set `AI2HUMAN_API_KEY` in your environment.

## Network Support

The AI2Human provider is network-agnostic (supports all networks).
