# PayPerByte Action Provider

This provider integrates [PayPerByte](https://x402.payperbyte.io) data feeds into AgentKit,
letting an agent list the feed catalog, pay for a feed with USDC on Base via x402, and
offline-verify the cryptographic receipt each response carries.

## Overview

PayPerByte publishes small, single-purpose data feeds (weather, earthquakes, security advisory
digests, and similar) behind the [x402 payment protocol](https://www.x402.org/), paid in USDC on
Base. Every response carries an `X-BYTE-Attestation` header: an EIP-712 signature over the exact
response bytes, under the "BYTE Library" domain.

**Scope, stated plainly:** verification here proves *authenticity and tamper-evidence* — that the
claimed publisher signed exactly the bytes you received. It is evidence toward authenticity, never
a certification, and it says nothing about whether the underlying data is *correct*.

This provider is standalone: it does not depend on, or need to be registered with, the built-in
`x402ActionProvider` — it wires its own x402 payment client directly, the same way
`dtelecomActionProvider` does for its own paid endpoints.

## Setup

No configuration required — the provider uses the default gateway URL
(`https://x402.payperbyte.io`) and a default USDC spend cap of 1.0 per query, matching the
built-in x402 action provider's default.

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { payperbyteActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [payperbyteActionProvider()],
});
```

Optional configuration:

```typescript
payperbyteActionProvider({
  maxPaymentUsdc: 0.5, // refuse to pay more than $0.50 for a single feed query
  baseUrl: "https://x402.payperbyte.io", // override for testing
  trustedPublishers: ["0x..."], // optional: gate `verified` on the signer being on this list
  attestationDomain: { chainId: 1, verifyingContract: "0x..." }, // CONSENSUS-CRITICAL migration override — see below
});
```

## Actions

| Action | Description |
|--------|-------------|
| `payperbyte_list_feeds` | Free, unauthenticated GET of the feed catalog — ids, descriptions, USDC prices. No payment. |
| `payperbyte_query_feed` | Pays for one feed via x402 (USDC on Base). Checks the catalog price against `maxPaymentUsdc` *before* attempting payment — refuses without paying if it exceeds the cap. Returns the response body and its `X-BYTE-Attestation` header verbatim. |
| `payperbyte_verify_attestation` | Offline verification of an `X-BYTE-Attestation` receipt against the exact body it covers. Makes no network call. |

## Verification: how it works, and what it does and doesn't prove

`payperbyte_verify_attestation` takes the exact response body string and the parsed attestation
object (both returned verbatim by `payperbyte_query_feed`) and:

1. **Pins the EIP-712 domain to all four fields** (name `"BYTE Library"`, version `"1"`,
   chainId `421614`, verifyingContract `0x44729bB148F46d8Db509E47b0453edc271e06e95` by default)
   and rejects a mismatch on any of them *before* recovery ever runs. The domain is never taken
   from the attestation's own claimed `domain` object — doing so would let a self-consistent
   forged attestation (signed and claimed under a domain of the attacker's own choosing, with
   `publisher` set to their own address) pass a naive "recovered === publisher" check without
   ever touching the real domain.
2. Recomputes `keccak256(utf8(body))` and checks it against the attestation's `payloadHash` and
   `payloadLength`.
3. Recovers the EIP-712 signer under the pinned domain and checks it matches the claimed
   `publisher` field.
4. If `trustedPublishers` is configured, additionally checks the recovered signer is on that
   list. If not configured, `verified` does not depend on *who* signed it — only that a key
   signed the exact bytes under the real domain. Either way, the result always includes
   `recoveredSigner` and a `publisherTrusted` field (`true`/`false` when the list is configured,
   `null` — with a note that policy is the caller's — when it is not).
5. Checks the attestation's `deadline` has not passed.

It **fails closed**: any domain mismatch, hash mismatch, signature-recovery failure, publisher
mismatch, untrusted signer, expired deadline, or malformed input returns `{verified: false,
reason: "..."}` — never a throw, and never a pass on ambiguous input. Input is `safeParse`'d
against the schema explicitly inside the action (not just relied on the caller's own validation),
and the whole action body is wrapped in try/catch as a backstop.

This proves the exact bytes you received were signed by a key under the real BYTE Library domain
at signing time — and, if you configure `trustedPublishers`, that the key is one you've chosen to
trust. It does **not** prove the data itself is accurate, current, or fit for any purpose — that
is a separate question the attestation makes no claim about.

### Migrating the attestation domain

`attestationDomain` exists only for a future, deliberate, coordinated migration of the BYTE
Library domain's `chainId`/`verifyingContract` (for example, moving off a testnet). The domain
**name** (`"BYTE Library"`) and **version** (`"1"`) are never overridable through this config —
only chainId and verifyingContract can change, and only when you specifically intend a migration.
Setting this incorrectly silently changes which signatures verification will accept; leave it
unset unless you know you need it.

### Attestation domain vs. payment rail

The `X-BYTE-Attestation` domain is anchored to `chainId 421614` (Arbitrum Sepolia) and
`verifyingContract 0x44729bB148F46d8Db509E47b0453edc271e06e95` — this is fixed and is **not** the
network payment settles on. Payment for PayPerByte feeds settles in USDC on **Base**
(`base-mainnet` / `base-sepolia`, `eip155:8453`). The attestation domain and the payment rail are
deliberately decoupled: the attestation is a standing cryptographic commitment anchored on one
chain, independent of which chain a given purchase happens to settle on. Both this provider's
`supportsNetwork` (Base only) and the attestation domain's chainId (always 421614) are correct
as written — they answer different questions.

## Network Support

`payperbyte_query_feed` requires an `EvmWalletProvider` on `base-mainnet` or `base-sepolia`.
`payperbyte_list_feeds` and `payperbyte_verify_attestation` make no payment and work with any
wallet provider (or none, for verification, since it takes its input as plain arguments).

## Dependencies

- [`viem`](https://viem.sh) — EIP-712 hashing and typed-data signature recovery (already an
  AgentKit dependency; no new dependency added for verification).
- `@x402/fetch`, `@x402/evm` — x402 payment protocol client, same libraries the built-in
  `x402ActionProvider` uses.
