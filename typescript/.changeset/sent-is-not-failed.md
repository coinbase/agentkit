---
"@coinbase/agentkit": patch
---

ERC-20 `transfer` and `approve` no longer answer "Error" when the transaction was sent and only the receipt lookup failed. They return the transaction hash, say the transaction was sent but is not confirmed yet, and tell the agent not to send it again, so a flaky RPC no longer leads to a duplicate payment. A transaction that was mined but reverted (for example a paused or blacklisting token) is now reported as reverted, with its hash, instead of "Transferred" or "Approved".
