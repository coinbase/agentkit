# TaskMarket action provider

This provider makes TaskMarket visible as an external-work option inside Coinbase AgentKit.

It provides four actions:

- `list_taskmarket_tasks` discovers open jobs using the public API.
- `get_taskmarket_task` inspects reward, deadline, lifecycle, and submission-window data.
- `list_taskmarket_submissions` tracks candidate work for review.
- `delegate_to_taskmarket` returns a reviewable plan and can call a host-provided create/fund adapter only after `confirm: true` and a `maxSpendUsdc` check.

## Safety boundary

The provider never stores or receives a private key and never silently spends USDC or accepts work. A host application must inject `createTask` with its own authenticated TaskMarket adapter, wallet permissions, and spending policy. With no adapter, confirmed creation returns a blocked result rather than attempting an unauthenticated write.

```ts
import { taskmarketActionProvider } from "@coinbase/agentkit";

const taskmarket = taskmarketActionProvider({
  createTask: async request => {
    // Connect this boundary to the first-party TaskMarket CLI/API adapter.
    // The host must authorize the payment and sign it here.
    return await authorizedTaskMarketClient.createAndFund(request);
  },
});

const agentKit = await AgentKit.configure({
  walletProvider,
  actionProviders: [taskmarket],
});
```

With `confirm: false`, the delegation action only produces a plan. The host should show that plan to the user or enforce a preconfigured policy before invoking it again with confirmation.
