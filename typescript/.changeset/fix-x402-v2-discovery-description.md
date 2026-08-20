---
"@coinbase/agentkit": patch
---

Fixed x402 discovery filtering to read the description of v2 resources from the discovery API's top-level `description` field, falling back to `metadata.description` and then `accepts[].description`. Previously only `metadata.description` was checked, so `filterByDescription` and `filterByKeyword` silently dropped every v2 resource that used the top-level field, which is the shape the live Bazaar discovery API returns.
