---
"@coinbase/agentkit": patch
---

Changed the viem dependency from an exact pin to `^2.47.4` so projects on a newer viem 2.x share one copy and their wallet clients typecheck in `ViemWalletProvider`.
