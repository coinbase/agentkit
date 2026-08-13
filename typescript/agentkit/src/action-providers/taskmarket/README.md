# TaskMarket action provider

`TaskMarketActionProvider` gives AgentKit agents a small, typed integration with
the TaskMarket REST API.

## What it provides

- `list_tasks` and `get_task` for public task discovery.
- `my_submissions` for read-only, wallet-authenticated submission history.
- `claim_task` for signing a documented claim intent.
- `submit_text` for uploading one explicit text artifact and submitting it
  through TaskMarket's upload-key flow.

Write actions are disabled by default. Enable them only after reviewing the
task and the intended artifact:

```ts
import { AgentKit } from "@coinbase/agentkit";
import { taskMarketActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.configureWithWallet({
  walletProvider,
  actionProviders: [
    taskMarketActionProvider({ allowWriteActions: true }),
  ],
});
```

The provider never stores private keys or API tokens. It uses the configured
`EvmWalletProvider` to sign TaskMarket's read, claim, and submission messages.
It only uploads content supplied directly to `submit_text`; it does not read
local files.

