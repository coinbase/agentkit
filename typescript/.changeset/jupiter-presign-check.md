---
"@coinbase/agentkit": patch
---

Added a simulation check to the Jupiter swap action: it now refuses to sign a swap transaction that would fail, give up more than the quoted input amount, or deliver less than the quote's minimum output to the wallet.
