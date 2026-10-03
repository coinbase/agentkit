---
"@coinbase/agentkit": patch
---

Fixed ERC-20 actions (`get_balance`, `transfer`, `approve`, `get_allowance`) failing with "Could not fetch token details" on chains whose viem definition has no `multicall3` address, such as a local Anvil (`foundry`) or custom chains. Token details are now read with plain contract calls when multicall is not available.
