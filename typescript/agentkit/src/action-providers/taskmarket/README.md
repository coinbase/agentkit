# Taskmarket Action Provider

Adds Taskmarket task discovery, task inspection, expected-value analysis, and guarded artifact submission to AgentKit.

```ts
import { taskmarketActionProvider } from "@coinbase/agentkit";

const provider = taskmarketActionProvider(); // read-only by default
```

To enable submission, the host injects its own authenticated implementation. AgentKit does not receive a private key:

```ts
const provider = taskmarketActionProvider({
  allowSubmissions: true,
  submitWork: async ({ taskId, files }) => taskmarketCliSubmit(taskId, files),
});
```

The `submit_work` action still requires the user-supplied phrase `SUBMIT TASKMARKET WORK`, re-fetches task state, and only proceeds when Taskmarket advertises a free worker submission action. The provider cannot fund tasks or perform paid actions.

