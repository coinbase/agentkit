---
"@coinbase/agentkit": patch
---

Fixed three EVM address comparisons that were case-sensitive: the erc20 transfer guardrail that refuses to send tokens to the token's own contract, the sushi router's native-asset check, and the yelay vault lookup. Each compared addresses as raw strings, so the same address written in a different case did not match. They now compare lowercased, as the rest of the codebase and the Python SDK already do.
