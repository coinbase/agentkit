# GLEE Verifier Action Provider

`verify_patch` checks unified diffs against path rules, static safety patterns, and regular-expression assertions over added lines. It costs exactly 50,000 atomic USDC ($0.05) on Base mainnet. Static acceptance does not apply patches, run tests, or prove program correctness.

Configure trust anchors in application code before exposing the action to an agent:

```typescript
import { AgentKit, gleeVerifierActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    gleeVerifierActionProvider({
      trustedPayTo, // Operator-approved Base USDC recipient (0x + 40 hex digits).
      trustedReceiptPublicKeyHex, // Independently trusted raw Ed25519 key (64 hex digits).
    }),
  ],
});
```

Obtain the recipient and public key from an independently trusted operator configuration. GLEE publishes public keys at `https://gleephoenix.com/.well-known/glee-receipt-keys` for comparison and rotation; a key or recipient supplied by a challenge or receipt never establishes trust. No production key is bundled. Missing or malformed trust configuration returns an error before requesting a payment signature. Legacy no-argument and endpoint-string constructors remain callable but require migration to the configuration object before payment can proceed. `endpoint` optionally selects another HTTPS endpoint with its own independently approved trust anchors.

Before signing, the provider checks the wallet chain ID, x402 V2/exact scheme, Base mainnet network, exact price, USDC contract, approved recipient, resource URL, token domain, and authorization timeout. Redirects are rejected. The action signs at most once and does not automatically retry a paid request.

A successful HTTP 200 delivery must contain the actual top-level `glee.acceptance_receipt.v0` receipt. The provider verifies its Ed25519 signature against the pinned key, full request hash (including patch, policy, assertions, and job ID), artifact/contract hashes, signed payment terms, and result content digest. Only authenticated result fields are returned, with `receipt_verified: true`. `PASS`, `FAIL`, and `INSUFFICIENT_EVIDENCE` retain their distinct meanings. Any missing verification capability, invalid signature, changed request/result, or unsuccessful HTTP status returns an error without an authenticated verdict. Signed settlement fields are seller attestations; the action does not independently reconcile the chain.

Inputs are `patch` (nonempty), optional `path_policy.allowed_paths`/`banned_paths`, optional `assertions` (`contains`/`prohibits`), and optional `job_id` (at most 128 characters). The request is snapshotted once for challenge, payment submission, and receipt validation.

The receipt implementation follows GLEE's frozen Acceptance v0 contract (`acceptance_v0.js`, `executePatchVerification` in `x402_verifier_service.js`, source revision `23501640bb728c4a2ddd121067bf6fdaf6db2d2b`). Signatures cover the UTF-8 SHA-256 hex digest of recursively sorted compact receipt JSON excluding only `signature`. Unknown schemas, verifier versions, and methodologies fail closed and require an explicit integration update.

`receipt.fixture.json` contains real service-generated receipts signed with a disposable local Ed25519 key and mocked settlement. Unit tests use mocked fetch and wallet signing only; no payments or live wallet signatures are performed.
