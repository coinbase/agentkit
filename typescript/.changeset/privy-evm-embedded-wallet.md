---
"@coinbase/agentkit": minor
---

Added support for Privy Evm embedded wallets with delegation. (Thanks @njokuScript!)

This change introduces a new wallet provider, `PrivyEvmDelegatedEmbeddedWalletProvider`, which allows AgentKit to use Privy's embedded wallets that have been delegated to a server. This enables autonomous agents to perform onchain actions on behalf of users who have delegated transaction signing authority to the agent.

Key changes:
- Add `PrivyEvmDelegatedEmbeddedWalletProvider` class extending the `EvmWalletProvider` base class
- Update the `PrivyWalletProvider` factory to support embedded wallets via a new `walletType` option