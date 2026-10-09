# Standing Witness Action Provider

Standing Witness provides autonomous epistemic standing audits and circuit breaker evaluation for onchain agents.

## Actions
- `standing_audit`: Request cryptographic epistemic standing verification for a claim, provenance record, or contract call.
- `circuit_breaker_gate`: Validate that an autonomous action meets confidence thresholds before executing irreversible operations.

Supports free dry-run testing via `mock: true`, live micropayments via x402 USDC on Base, or prepaid developer credit tokens.
