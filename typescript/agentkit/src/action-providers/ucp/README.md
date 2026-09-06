# UCP Action Provider

The `UcpActionProvider` provides actions for interacting with merchants implementing Google's Universal Commerce Protocol (UCP) with non-custodial x402 settlement on Base L2.

## Features

- **Merchant Discovery**: Discover merchant capabilities, accepted payment methods, and endpoints via `/.well-known/ucp`.
- **Quote Negotiation**: Request locked price quotes with `validUntil` expiration limits.
- **Payee-Binding Security**: Computes cryptographically bound nonces to protect against payment frontrunning and address diversion.
- **Non-Custodial Payments**: The action provider never holds private keys; signatures are requested locally through the agent's `EvmWalletProvider`.
- **Receipt Verification**: Cryptographically verifies `XDR-1` Execution Delivery Receipts using RFC 8785 JSON Canonicalization Scheme (JCS) and secp256k1 signature recovery.

## Actions

1. `ucp_discover`: Resolves `/.well-known/ucp` on the target merchant domain.
2. `ucp_quote`: Requests a server-locked checkout session.
3. `ucp_compile`: Audits order total against spending caps and derives the payee-binding commitment nonce.
4. `ucp_pay`: Prepares and requests an EIP-3009 `TransferWithAuthorization` signature from the wallet provider.
5. `ucp_verify_receipt`: Canonicalizes and verifies the cryptographic delivery receipt returned by the merchant.
