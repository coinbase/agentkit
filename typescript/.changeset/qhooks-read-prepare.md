---
"@coinbase/agentkit": patch
---

Added the QHooks action provider for market and stored-proof reads, portfolios, perps, OTC and agreement plans. Returned unsigned plans require the user wallet to review and sign.

Validate unsigned spot-trade plans against the local request before wallet review: chain ids, pinned targets, exact approvals, decoded swap amount/minimum/referrer/deadline/native value, and the canonical SHA-256 integrity tuple. The unsigned digest is not authentication or price assurance.

Refresh the reviewed static31tool catalog, current token quote and Expert Studio schemas, competition and agent-profile preparations. Feedback is separately host-opted and default OFF. Native drift tests compare exact catalog semantics and reject unreviewed tools.
