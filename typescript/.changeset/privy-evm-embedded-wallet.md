---
"@coinbase/agentkit": minor
---

Add support for Privy Evm embedded wallets with delegation.

This change introduces a new wallet provider, `PrivyEvmEmbeddedWalletProvider`, which allows AgentKit to use Privy's embedded wallets that have been delegated to a server. This enables autonomous agents to perform on-chain actions on behalf of users who have delegated transaction signing authority to the agent.

Key changes:
- Add `PrivyEvmEmbeddedWalletProvider` class extending the `EvmWalletProvider` base class
- Update the `PrivyWalletProvider` factory to support embedded wallets via a new `walletType` option
- Add comprehensive test coverage for the new provider
- Add documentation on how to use the embedded wallet provider