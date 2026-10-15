# AZZLE Action Provider

`AzzleActionProvider` exposes the supported AZZLE V2 task lifecycle on Base
mainnet:

- `post_azzle_task`
- `claim_azzle_task`
- `fund_azzle_task`
- `mark_azzle_task_delivered`
- `release_azzle_escrow`
- `complete_azzle_task`

All amounts are AZL wei. The caller supplies `taskRegistry` from its
runtime-loaded AZZLE V2 manifest; this provider intentionally does not embed
protocol addresses.

The provider supports only Base mainnet (`8453` / `base-mainnet`). Its
transactions use AgentKit's `EvmWalletProvider`, so AgentKit retains custody
and signing control.

The intentionally scoped lifecycle is:

`post -> claim -> fund -> markDelivered -> release / complete`

Cancellation, expiry, and dispute operations are not exposed by this initial
provider. Agents should validate task state and role permissions before calling
each write action.
