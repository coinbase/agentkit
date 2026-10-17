# Standing Witness Action Provider

Inspect the integrity of ordinary source-attributed signed records. These records are not sealed WHP Standing Marks. This provider does not verify current standing or authorize execution.

## Actions

- `standing_audit`: Inspect an ordinary record's Ed25519 signature, canonical hash, exact request binding, and issuance window. This does not establish independent truth, current standing, or execution permission.
- `circuit_breaker_gate`: Fail closed for live requests. Even a verified ordinary record returns `gate_status: "BLOCKED"` and `execution_authorized: false`. Explicit mock mode returns `DRY_RUN_PASSED`, also with `execution_authorized: false`.

## Limits

Mock mode is a non-authorizing structural dry run, not permission to execute a transaction. It still sends the submitted request to the service.

The provider gets the advertised ordinary front-door signing key from its configured service. That is not an independent canonical-root trust check. The submitted proposed action, target, and dollar value are bound as request evidence; this is not a cryptographic warrant for an exact executable transaction.

Live service requests can use x402 USDC on Base or a prepaid developer credit token. A request can charge for an evaluation even when the gate blocks. Payment does not buy clearance. This provider does not create a payment authorization for you.
