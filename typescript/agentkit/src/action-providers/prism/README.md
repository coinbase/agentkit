# Prism Action Provider

This provider gives an agent metered GPU compute on [Prism Network](https://prismnetwork.tech), paid per call with USDC on Base over the [x402 payment protocol](https://www.x402.org/).

## Overview

Prism rents GPUs from independent operators and meters them by the second. There is no account to open and no API key to hold: the agent reads the price from the 402 response, pays from its own wallet, and gets the result in the same request.

## Setup

No configuration required. The provider uses the public API at `https://api.prismnetwork.tech` and pays with the wallet the agent already has.

```typescript
import { AgentKit, prismActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [prismActionProvider()],
});
```

Both settings are optional:

```typescript
prismActionProvider({
  apiBase: "https://api.prismnetwork.tech", // point at a different deployment
  maxPaymentUsdc: 1, // most a single action may pay, default 1 USDC
});
```

Prism prices inference by the token cap requested, so a large cap on a large batch is the one way an agent can spend more than it meant to. `maxPaymentUsdc` bounds that: any payment option quoted above the cap is dropped before the wallet signs anything.

## Actions

| Action | Cost | Description |
|--------|------|-------------|
| `get_models` | free | Models Prism serves, their prices, and whether a GPU is warm |
| `run_inference` | ~0.003–0.012 USDC | One LLM generation on a rented GPU |
| `run_batch` | scales with prompt count | Many independent prompts in one paid call, with a Merkle receipt over the set |
| `run_gpu_command` | 0.03 USDC | Lease a GPU and run one shell command on it |
| `get_gpu_job` | free | Status and output of a queued GPU command |

## Notes

**Batches carry an audit path.** `run_batch` spreads prompts across every GPU the gateway holds and returns a Merkle receipt over the whole set. Each answer comes with its own commitment hash and audit path, so any single answer can be checked against the batch root without revealing the others.

**A cold pool costs nothing.** When no GPU is warm, the paid endpoints answer with a retry notice and take no payment. The provider surfaces this as `{"charged": false, "retryAfterSeconds": ...}` so the agent can wait rather than treat it as a failure.

**GPU commands are queued.** `run_gpu_command` returns a job id and a token; poll with `get_gpu_job`. Payment is only taken once the job has succeeded, so a job that fails costs nothing.

## Networks

Prism quotes payment on Base (USDC) and Robinhood Chain (USDG). Any EVM wallet provider works; a wallet funded with USDC on Base mainnet is the usual setup.
