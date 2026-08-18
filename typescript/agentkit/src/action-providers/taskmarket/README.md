# Taskmarket Action Provider

The `taskmarketActionProvider` adds Taskmarket discovery and explicit task-creation actions to AgentKit.

```ts
import { AgentKit, taskmarketActionProvider } from "@coinbase/agentkit";

const agentKit = new AgentKit({
  walletProvider,
  actionProviders: [taskmarketActionProvider({ maxRewardUsdc: 25 })],
});
```

The provider exposes three actions:

- `list_tasks` reads the public Taskmarket feed and supports reward, tag, mode, deadline, and pagination filters.
- `get_task` reads one task's specification, escrow state, submission window, and available next actions.
- `create_task` previews a task without making a request when `confirm` is `false`. It only submits the x402-paid creation request when `confirm` is `true`, the wallet is on Base mainnet, and the reward is within the configured `maxRewardUsdc` limit.

Taskmarket task creation pays the requested reward into escrow at creation time. Applications should present the exact description and reward to their user and set `confirm: true` only after explicit approval. Discovery and task detail reads never move funds.
