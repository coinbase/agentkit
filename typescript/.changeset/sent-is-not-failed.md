---
"@coinbase/agentkit": patch
---

ERC-20 `transfer` and `approve` no longer answer "Error" when the transaction was sent and only the receipt lookup failed. They return the transaction hash, say the transaction was sent but is not confirmed yet, and tell the agent not to send it again, so a flaky RPC no longer leads to a duplicate payment. A transaction that was mined but failed (for example a paused or blacklisting token) is now reported as failed, with its hash, instead of "Transferred" or "Approved". This covers both receipt vocabularies the wallet providers return: viem transaction receipts ("success" / "reverted") and CDP smart-wallet user operations ("complete" / "failed"). Only a status that says the transaction succeeded is reported as done; any other status is reported as sent but not confirmed. Reported in #1558 by @0xLittleDream.
