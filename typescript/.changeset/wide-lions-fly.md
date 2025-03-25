---
"create-onchain-agent": minor
---

Added code generation for individual building blocks

Projects bootstrapped with the `create-onchain-agent` CLI will also have the `agenkit` CLI installed.
- `agentkit generate wallet-provider`: Generate a custom wallet provider
- `agentkit generate action-provider`: Generate a custom action provider
- `agentkit generate prepare`: Generate framework-agnostic AgentKit setup
- `agentkit generate create-agent`: Generate framework-specific agent creation
