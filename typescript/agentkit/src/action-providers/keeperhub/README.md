# KeeperHub Action Provider

This directory contains the **KeeperHubActionProvider**, which routes transfers through [KeeperHub](https://keeperhub.com) instead of signing them with the local wallet, and lets the agent ask afterwards what actually happened.

## Directory Structure

```
keeperhub/
├── keeperHubActionProvider.ts        # Provider with transfer and get_execution_status
├── keeperHubActionProvider.test.ts   # Provider tests (fetch is faked, the real client runs)
├── keeperHubClient.ts                # Thin REST client and idempotency key derivation
├── keeperHubClient.test.ts           # Idempotency key tests
├── constants.ts                      # Base URL, supported chains
├── schemas.ts                        # Action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `transfer`: simulates the transfer through KeeperHub, aborts before broadcast if the simulation predicts a revert, then executes once under an idempotency key derived from `taskId` and the fields that decide the onchain effect. Returns an `executionId`.
- `get_execution_status`: answers "did the money move?" for an `executionId`, with receipts re-read from chain: succeeded, reverted, or not yet known (which is not the same as failed).

## Why

When a transfer is broadcast but the confirmation is lost (for example, receipt polling fails), `erc20.transfer` returns an error string with no identifier to ask about again. The agent cannot tell "never sent" from "sent, answer lost", so a retry can pay twice (see #1483). With this provider a retry of the same `taskId` is replayed, not resent, and the outcome can always be asked for.

Measured on Base Sepolia, 100 trials per arm with `eth_getTransactionReceipt` rejected on purpose: the outcome was determinable in 0 of 100 trials through `erc20.transfer` and in 99 of 100 through this provider; duplicate transfers 47 of 47 vs 0 of 100. Method and every transaction hash: https://github.com/scientivan/resi

## Configuration

```typescript
import { keeperHubActionProvider } from "@coinbase/agentkit";

const provider = keeperHubActionProvider({
  apiKey: process.env.KEEPERHUB_API_KEY, // organisation key, prefixed kh_
});
```

`KEEPERHUB_API_KEY` is read from the environment when `apiKey` is omitted.

## Network Support

Any EVM network KeeperHub supports, including Base, Base Sepolia, Ethereum, Sepolia, Arbitrum, Optimism and Polygon. See `constants.ts` for the full list. Unsupported chains are refused locally rather than sent to the server.

## Notes

- The simulation flag is set by code, never by model input, so it cannot be switched off.
- `taskId` is the durable handle. Recovery through the same `taskId` lasts 24 hours; after that the same key executes again.
- Only transfers are supported. Contract calls and protocol actions are not.
