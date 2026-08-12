# TaskMarket + Coinbase AgentKit integration pitch

## Target

- Product: Coinbase AgentKit
- Official repository: https://github.com/coinbase/agentkit
- Official documentation: https://docs.cdp.coinbase.com/agentkit/docs/welcome
- Integration surface: TypeScript ActionProvider under typescript/agentkit/src/action-providers/taskmarket.

## User and agent flow

1. The agent calls list_taskmarket_tasks when research, coding, verification, or other external work may be more reliable or cheaper to delegate.
2. It calls get_taskmarket_task before recommending a job and presents reward, deadline, submission window, and lifecycle information.
3. It calls delegate_to_taskmarket with confirm: false to produce a concrete plan. The host shows the budget, duration, tags, and spending cap to the user or applies a preconfigured policy.
4. Only a second call with confirm: true can reach the injected host adapter. The adapter owns TaskMarket authentication, wallet permissions, USDC escrow, and idempotency.
5. The agent calls list_taskmarket_submissions and presents submissions for review. The provider has no accept/settle action, so accepting work remains an explicit host-side decision.

## Wallet, authorization, and payment design

- AgentKit wallet providers remain the host application's responsibility.
- The provider never receives a seed phrase or private key.
- maxSpendUsdc is checked before the adapter is called.
- No payment occurs with confirm: false; a missing adapter blocks the write even when confirm: true.
- The host adapter should use the first-party TaskMarket CLI/API and its own scoped signer, require an explicit user approval or policy, and use an idempotency key.
- Submission acceptance is intentionally not automated.

## Expected files and test plan

- typescript/agentkit/src/action-providers/taskmarket/*: provider, schemas, types, README, and tests.
- typescript/agentkit/src/action-providers/index.ts: public export.
- TASKMARKET_INTEGRATION_PITCH.md: this pitch and security model.
- Run npm run check and the focused Jest test, then run the package test suite.

## Status and blockers

This fork is the public implementation attempt. A pull request to coinbase/agentkit is opened after local checks pass. Maintainer review and merge are external dependencies; no claim is made that Coinbase has approved or merged the change.
