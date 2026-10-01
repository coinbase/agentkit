---
"@coinbase/agentkit": patch
---

Forwarded an optional `idempotencyKey` from `CdpEvmWalletProvider.sendTransaction`/`nativeTransfer` and `CdpSmartWalletProvider.sendTransaction`/`nativeTransfer` to the CDP SDK. The SDK already accepts the parameter on `sendTransaction` and `sendUserOperation`, but neither provider passed it, so an agent retry after a lost or ambiguous response submitted a second, independently valid transfer of the same value. Callers that retry the same logical transfer should pass the same key; when no key is supplied the behaviour is unchanged.
