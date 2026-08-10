# Taskmarket Action Provider

The `TaskMarketActionProvider` connects an AgentKit EVM wallet to the
[Taskmarket](https://taskmarket.dev/) worker workflow on Base mainnet.

It exposes three actions:

- `list_tasks`: discover open USDC tasks without spending funds.
- `get_task`: inspect a task, escrow transaction, deadline, and pending actions.
- `submit_work`: submit a complete text artifact after explicit user
  authorization. The worker wallet signs `taskmarket:submit:<taskId>` and the
  provider sends the artifact to Taskmarket. It does not automatically pay an
  X402 fee; payment-required responses are returned as errors.

```ts
import { AgentKit, taskMarketActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.configureWithWallet({
  walletProvider,
  actionProviders: [taskMarketActionProvider()],
});
```

Submissions are public to the requester and may be visible to other workers,
so never submit private keys, credentials, or confidential data. Re-fetch the
task before submitting and verify that it is still open and accepting work.
