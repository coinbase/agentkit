# TaskMarket Action Provider

Lets an agent discover paid work on [TaskMarket](https://taskmarket.dev), a task
marketplace where requesters escrow USDC on Base and workers submit deliverables.

The point is delegation. An agent that recognises a request is better handled by
external workers can look for existing funded work instead of burning inference
on something it will do badly, and can hand its operator a link rather than an
unreliable answer.

## Actions

| Action | What it does |
| --- | --- |
| `browse_tasks` | Lists open tasks, sorted by net reward, with deadline and how contested each already is |
| `get_task_details` | Full acceptance criteria, reward, deadline and award count for one task |
| `evaluate_delegation` | Given a description of work in hand, surfaces open tasks that overlap with it |

## Setup

No API key, no wallet, no configuration:

```typescript
import { taskmarketActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [taskmarketActionProvider()],
});
```

The discovery endpoints on the TaskMarket public API are unauthenticated and
read-only. `baseUrl` can be overridden for testing.

## Scope, and what is deliberately excluded

Every action here is **read-only**. This provider does not spend funds, touch a
wallet, create a task, claim work, accept submissions, or hold a key.

Creating a task and submitting work both move real USDC through escrow. Those
belong behind explicit human authorization, so they are intentionally left to the
first-party TaskMarket CLI rather than exposed as agent actions. An agent should
be able to tell its operator "this is already funded, here is the link" without
being able to spend on their behalf.

`evaluate_delegation` reflects this in its output: it returns candidates and
states plainly that acting on them requires operator authorization.

## Notes on the output

- Rewards are reported **net of the platform fee**, because that is what a
  worker would actually receive.
- Submission counts are included deliberately. A 64 USDC task with 142
  submissions is often worth less in expectation than a 4 USDC task with three,
  and an agent recommending work should be able to see that.
- Descriptions are collapsed to one line in list views. Task descriptions run to
  several hundred words of markdown, and pasting them verbatim into a context
  window is the fastest way to make a discovery tool unusable.
- Matching in `evaluate_delegation` is transparent keyword overlap rather than
  an embedding lookup, so it costs no extra model call and an operator can
  predict what it will do.

## Network support

Network-agnostic. Browsing work reads a public HTTP API and touches no wallet.
Settlement happens in USDC on Base, but only once a user acts on a task outside
this provider.
