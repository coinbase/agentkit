---
"@coinbase/agentkit": patch
---

Added a KeeperHub action provider with `transfer` (simulate, then execute once under an idempotency key derived from the work) and `get_execution_status` (outcome with receipts re-read from chain)
