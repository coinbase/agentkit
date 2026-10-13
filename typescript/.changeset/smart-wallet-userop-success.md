---
"@coinbase/agentkit": patch
---

Reported a smart wallet user operation as failed when the EntryPoint marked it unsuccessful. `CdpSmartWalletProvider.waitForTransactionReceipt` returned `status: "complete"` whenever the bundle transaction was mined, including when the operation's own call reverted, so an action could report a transfer that never happened. The status now follows the `success` field of the operation's `UserOperationEvent` in the bundle transaction's logs; with no matching event it is left unchanged.
