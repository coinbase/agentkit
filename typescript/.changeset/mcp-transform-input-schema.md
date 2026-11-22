---
"@coinbase/agentkit-model-context-protocol": patch
---

Fixed `getMcpTools` throwing "cannot be represented in JSON Schema" when an action schema uses a transform or a custom type (pyth, x402, CDP swap, erc8004, wow and others), by building tool input schemas from the input side of the schema
