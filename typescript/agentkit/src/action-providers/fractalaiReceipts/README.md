# FractalAI Receipts Action Provider

This directory contains the **FractalaiReceiptsActionProvider**, which lets an agent verify post-quantum signed receipts of x402 payments and request an independent notary seal of a payment it already made.

Receipts are signed with ML-DSA-65 (NIST FIPS 204) and can be verified offline, long after the HTTP exchange. Maintained by [FractalAI](https://fractalai.net.co) (FRACTAL AI S.A.S.).

## Directory Structure

```
fractalaiReceipts/
├── fractalaiReceiptsActionProvider.ts       # Provider with the two actions
├── fractalaiReceiptsActionProvider.test.ts  # Tests (real FractalAI fixtures, no network)
├── schemas.ts                               # Action schemas and configuration type
├── constants.ts                             # Pinned trust roots and protocol constants
├── verifier.ts                              # Receipt verification (levels, reasons)
├── directory.ts                             # Key directories and key lifecycle
├── encoding.ts                              # Strict JSON, JCS, base64, ML-DSA-65 verify
├── notary.ts                                # Notary seal body and payment policy
├── fixtures/                                # Published directory, trust roots, a real receipt
├── index.ts                                 # Main exports
└── README.md                                # This file
```

## Actions

### `verify_x402_receipt`

Verifies a receipt and reports each level separately:

| Level | Meaning |
|---|---|
| `integrity` | The document is well-formed and every unsigned field that repeats signed content matches it exactly. |
| `authentic` | The ML-DSA-65 signature verifies over the message rebuilt from the kind's fixed domain. |
| `trusted` | The signing key is listed in a verified key directory, has the right `use`, and is authorized at the signed time (`reserved` and `revoked` keys never are). |
| `settlement` | The receipt names the transaction and payer you observed (only when `expectedTransaction` / `expectedPayer` are given). |
| `delivery` | The signed body digest equals the SHA-256 of the body you received (only when `responseBody` is given). |

`valid` is true only if `integrity`, `authentic` and `trusted` are true and no evaluated optional level is false. `trustBasis` states why the key is trusted:

- `pinned-root`: FractalAI receipts. The FractalAI key directory (`https://fractalai.net.co/.well-known/x402-receipt-keys`, or a copy you supply) is checked against the governance key and the epoch-3 checkpoint pinned in `constants.ts`. An older epoch is refused as a rollback, a different root for epoch 3 as equivocation, and a newer epoch is accepted only with the intermediate epochs (config `directoryHistory`).
- `pinned`: third-party `delivery-receipt` issuers whose governance key you pinned in `pinnedIssuerGovernanceKeys`.
- `tls`: third-party issuers without a pin. Their directory is fetched from `<issuer>/.well-known/x402-receipt-keys` over HTTPS and accepted on first use; the verdict says so.

Supported kinds (set `kind` when you know it; otherwise it is inferred from the document's shape, never from a field that claims a domain):

| Kind | Signed message |
|---|---|
| `delivery-receipt` | `x402-delivery-receipt/1\n` + sha256(JCS(payload)), per the proposed x402 `delivery-receipt` extension |
| `x402-seal` | `FRACTALAI-x402-served-v1\nx402-witness\n` + sha256(JCS(body)) (FractalAI notary) |
| `served-proof` | `FRACTALAI-x402-served-v1\n<route>\n<digest>` |
| `midas-alert` | `FRACTALAI-x402-served-v1\nmidas-alert\n` + sha256(canonical) |

Example:

```typescript
{
  receipt: "<the receipt JSON text, as received>",
  kind: "delivery-receipt",
  responseBody: "<the exact body text you received>",
  expectedTransaction: "0x5c6e...",
  expectedPayer: "0x857b...",
  keyDirectory: null
}
```

### `request_x402_receipt`

Asks the FractalAI notary (`https://fractalai.net.co/api/x402/witness`) for an independent seal of an x402 payment that already settled on Base mainnet:

1. builds the `seal_body` (schema `fractalai.x402-settlement-seal/0.1`: resource, scheme, network, asset, payTo, amount, payer, transaction, success, response_sha256, sealed_at);
2. sends it; the notary re-derives the transfer from Base before asking for payment and answers 422 (nothing charged) if it does not match;
3. pays the notary's fee through `@x402/fetch` with the agent's EVM wallet. A payment policy only accepts `exact` USDC on Base to FractalAI's pinned address, up to `maxPaymentUsdc` (default 0.005 USDC); anything else is refused before a payment is signed;
4. verifies the returned seal as an `x402-seal` and checks that it describes the submitted payment. The notary replaces `payer` with the sender it observed on-chain; `payerClaimMatches` reports whether that equals your claim.

Requires an EVM wallet provider on `base-mainnet` holding USDC.

## Configuration

```typescript
import { fractalaiReceiptsActionProvider } from "@coinbase/agentkit";

const provider = fractalaiReceiptsActionProvider({
  maxPaymentUsdc: 0.005, // cap per notary seal (default: the notary's price)
  acceptedIssuers: ["https://notary.example.com"], // extra delivery-receipt issuers, besides the resource origin
  pinnedIssuerGovernanceKeys: { "https://api.example.com": ["<base64 ML-DSA-65 key>"] },
});
```

## Scope and limits

- A valid receipt proves that a trusted key signed these exact bytes at the signed time. It does not prove that the content is true, correct or complete. A MIDAS alert, for example, proves what FractalAI's scanner signed, not that a position will be liquidated.
- Unless `settlement` is checked, a receipt does not prove that the payment happened; this provider compares the receipt with what you observed and does not query the chain itself. Notary seals carry `notary_verified_onchain` when the notary checked the transfer on Base.
- The FractalAI governance key and checkpoint were pinned from the TLS-served directory on 2026-10-07 (trust on first use, made explicit). Governance key rotation is not handled: a directory signed by another key is refused.
- Revoked keys are never trusted, because a signed time alone cannot show that a receipt predates revocation. Consensus time anchors that could lift this are not verified by this provider.
- `delivery-receipt` is a proposed x402 extension, not yet part of the x402 specification. Only the `ml-dsa-65` algorithm is implemented here.
- Cryptography comes from `@noble/post-quantum` (pure JavaScript). It is not a CMVP / FIPS 140-3 validated module; "post-quantum" means resistant to known quantum attacks, not unbreakable.
- Strings from receipts are sanitized before they are returned to the model and are data, not instructions.
