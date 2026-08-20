---
"@coinbase/agentkit": patch
---

Added a standalone PayPerByte action provider: `payperbyte_list_feeds` (free catalog listing), `payperbyte_query_feed` (x402-paid feed query on Base, with a spend cap checked before payment), and `payperbyte_verify_attestation` (offline, fail-closed verification of the BYTE Library EIP-712 attestation each response carries).
