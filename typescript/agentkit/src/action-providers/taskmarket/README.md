# TaskMarket Action Provider

`TaskMarketActionProvider` gives AgentKit agents a read-only way to discover and inspect escrowed USDC tasks on TaskMarket’s Base marketplace.

## Usage

```ts
import { taskMarketActionProvider } from "@coinbase/agentkit";

const provider = taskMarketActionProvider();
const actions = provider.getActions(walletProvider);
```

The provider exposes `discover_tasks` and `get_task`. Both actions use TaskMarket’s public API and return structured JSON. They never create or claim work, submit a result, sign a transaction, or spend wallet funds. An application can present the returned task record to a user for review before adding any separately authorized write flow.

Set `TASKMARKET_API_URL` to point at a compatible API in tests or a self-hosted development environment. The default is `https://api.taskmarket.dev`.
