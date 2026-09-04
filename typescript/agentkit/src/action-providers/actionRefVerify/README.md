# Action Ref Verify Action Provider

This directory contains the `ActionRefVerifyActionProvider` implementation, which provides actions to derive and independently check content-addressed references for agent actions (`action-ref-v1` spec).

## Overview

`ActionRefVerifyActionProvider` is a read-only, no-wallet action provider that:

1. Derives `action_ref` — a deterministic, content-addressed identifier for a declared agent action (`SHA-256` of RFC 8785 JCS over `{agent_id, action_type, scope, timestamp}`).
2. Checks whether a given `action_ref` has been anchored on-chain, via a permissionless `AnchorRegistry.anchor(bytes32)` call (same CREATE2 address on Base, Arbitrum One, and Ink).

It makes no transactions and requires no wallet — the anchor itself, if any, is written by whoever chooses to (the agent's own operator, or any third party), independently of this provider.

A full worked example, including a real on-chain anchor, is published at [`giskard09/coinbase-x402-action-ref-anchor`](https://github.com/giskard09/coinbase-x402-action-ref-anchor) — modeled on this repo's own `X402ActionProvider.retryWithX402`.

## Directory Structure

```
actionRefVerify/
├── actionRefVerifyActionProvider.ts    # Main provider with compute/verify actions
├── actionRefVerifyActionProvider.test.ts  # Test file for the provider
├── schemas.ts                          # Action schemas
├── constants.ts                        # AnchorRegistry address, RPC endpoints, event topic
├── utils.ts                            # JCS canonicalization + SHA-256 helpers
├── index.ts                            # Main exports
└── README.md                           # This file
```

## Actions

### `compute_action_ref`

Computes `action_ref` from four declared fields, per `action-ref-v1`. Pure derivation — no network calls.

### `verify_action_ref_anchor`

Queries the given chain's public RPC directly for an `Anchored(bytes32,address,uint256)` event matching a given `action_ref`. Does not trust any off-chain report of anchor status — it reads the chain.

## What this does NOT do

- Does not verify that a declared action actually happened as described.
- Does not evaluate whether an action was safe or advisable.
- Does not sign, dispatch, or modify any transaction, payment, or other agent action.
- Does not require any change to any other provider's API — it composes with any action's declared inputs/outputs after the fact.

## Notes

For more information on the `action-ref-v1` spec, see [argentum-core/docs/spec/action-ref.md](https://github.com/giskard09/argentum-core/blob/master/docs/spec/action-ref.md).

For more information on all the available action providers & wallet providers, see the [README.md](../../../README.md) file.
