---
"@coinbase/agentkit": patch
---

Fixed x402 service discovery dropping every v2 resource: descriptions are read from the top-level `description` field returned by the discovery API, with `metadata.description` kept as a fallback
