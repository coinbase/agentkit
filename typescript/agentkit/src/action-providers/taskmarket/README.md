# Taskmarket Action Provider

This directory contains the **TaskmarketActionProvider**, which lets an AgentKit agent discover, track, review, and create work on the **Taskmarket** onchain task marketplace (USDC on Base L2). Taskmarket lets requesters escrow USDC and have workers earn payouts for accepted onchain work.

## Directory Structure

```
taskmarket/
├── taskmarketActionProvider.ts    # Main provider with Taskmarket functionality
├── taskmarketActionProvider.test.ts # Test file for Taskmarket provider
├── schemas.ts                     # Task action schemas
├── constants.ts                   # Taskmarket integration constants
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `list_tasks`: Browse open (submittable) Taskmarket tasks, optionally filtered by mode, max reward, or search text. Read-only; no wallet or secrets required.
- `get_task`: Fetch the live status of a single Taskmarket task (status, phase, submission window, reward, submissions, award count, expiry). Read-only.
- `list_submissions`: Present a task's submissions for human review (worker, submitted/rejected state). Read-only, and it **never accepts or rejects** work — that decision stays with a human via the first-party CLI.
- `create_task`: Create (and fund) a Taskmarket task as a requester with **hard safety gates**: the wallet must be on Base (8453), the exact USDC cost is computed and surfaced, a **max-spend cap** is enforced, and a **fresh, explicit user authorization** string is required before anything is created.

## Safety model

The read actions are public REST calls against `https://api.taskmarket.dev` and need no wallet, no keys, and no spend.

The `create_task` action is a funded onchain write and is deliberately conservative:

- **Network guard** — refuses unless the wallet is connected to Base (chain id 8453), where Taskmarket escrows USDC.
- **Explicit authorization** — the action refuses to create unless the caller passes an authorization string containing the exact total the user agreed to, e.g. `I authorize paying 5 USDC`.
- **Max-spend cap** — a hard per-task cap (default `TASKMARKET_MAX_TASK_SPEND_USDC`, 25 USDC) that a task may not exceed unless a higher `maxSpendUsdc` is passed explicitly.
- **First-party tooling** — the actual USDC escrow, X402 payment, legal acceptance, idempotency, and wallet signing are delegated to the official `taskmarket` CLI, so no private key, seed phrase, token, or cookie is requested, stored, logged, or committed.
- **No silent retry** — if a payment result is ambiguous or in-flight, the action reports it and instructs polling by task id; it never blindly resubmits a payment whose settlement status is unknown.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `TASKMARKET_API_URL` | `https://api.taskmarket.dev` | Backend base URL (read actions) |
| `TASKMARKET_MAX_TASK_SPEND_USDC` | `25` | Default hard per-task spend cap |
| `TASKMARKET_CLI` | `taskmarket` | First-party CLI binary used for the funded write |
| `TASKMARKET_CLI_TIMEOUT_MS` | `180000` | Timeout for the CLI write |

## Usage Example

```typescript
import { TaskmarketActionProvider } from "@coinbase/agentkit";

const provider = taskmarketActionProvider();

// Browse open work (no wallet)
const tasks = await provider.listTasks({ mode: "bounty", maxRewardUsdc: 6 });

// Track a posted task's status (no wallet)
const status = await provider.getTask({ taskId: "0x..." });

// Present submissions for review (no wallet)
const subs = await provider.listSubmissions({ taskId: "0x..." });

// Create a task (needs a Base wallet + explicit authorization)
const created = await provider.createTask(walletProvider, {
  description: "Build a small browser game",
  rewardUsdc: 5,
  durationHours: 72,
  mode: "bounty",
  taskVisibility: "public",
  submissionVisibility: "public",
  tags: ["game"],
  authorization: "I authorize paying 5 USDC", // must match the exact total
});
```

Requires the first-party CLI for the funded write path:

```bash
npm install -g @lucid-agents/taskmarket@latest
taskmarket init   # one-time: creates the CLI-owned signing wallet
```

## Adding New Actions

1. Define your action schema in `schemas.ts`
2. Implement the action in `taskmarketActionProvider.ts`
3. Add tests in `taskmarketActionProvider.test.ts`

## Network Support

Taskmarket runs on **Base Mainnet (8453)** and escrows **USDC**. The read actions are network-neutral; the funded write is Base-gated inside `create_task`. See [Taskmarket Docs](https://docs.taskmarket.dev/) for the protocol reference.
