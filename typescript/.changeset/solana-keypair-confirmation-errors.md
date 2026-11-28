---
"@coinbase/agentkit": patch
---

Fixed Solana keypair transaction sends to reject confirmed execution failures instead of returning their signatures as completed sends. Preserved the low-level confirmation response API.
