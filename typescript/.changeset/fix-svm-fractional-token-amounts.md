---
"@coinbase/agentkit": patch
---

Fixed SPL `transfer` and Jupiter `swap` failing for fractional amounts that are not exact in floating point (e.g. 2.01 tokens with 6 decimals)
