---
"@coinbase/agentkit": patch
---

Fixed the Pyth `fetch_price_feed` action crashing with "Cannot read properties of undefined (reading 'toLowerCase')" now that Hermes no longer returns `attributes.base`, by falling back to the base asset in the feed symbol
