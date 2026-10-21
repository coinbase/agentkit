---
"@coinbase/agentkit": patch
---

Added `tapLabsActionProvider` with two safety checks an agent can run before it buys, swaps or signs: `check_token_safety` (TAP Labs' Safety Check, for tokens on Base and Solana and contracts on Base) and `check_transaction` (TAP Labs' Wallet Firewall, for transactions, approvals, permits and sign-in messages). Each check is paid per call in USDC on Base with x402 from the agent's wallet. Before signing, the provider refuses any payment that is not a short-lived exact USDC payment on Base mainnet, to TAP's wallet, at or under a per-check cap, and it stops at a total budget per provider instance. The x402 library gets only the wallet's address and typed-data signing.
