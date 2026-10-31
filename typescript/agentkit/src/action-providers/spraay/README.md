# Spraay Action Provider

This directory contains **SpraayActionProvider**, payment coordination for AgentKit agents on Base. Batch payments are the core capability — send ETH or any ERC-20 token to up to 200 recipients with per-recipient amounts, atomically, in a single transaction — with escrow creation via the Spraay gateway as the complementary second pillar.

Contract: [`0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC`](https://basescan.org/address/0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC) (Base Mainnet) · Gateway: `https://gateway.spraay.app` · Website: [spraay.app](https://spraay.app)

## Directory Structure

```
spraay/
├── spraayActionProvider.ts       # Provider: on-chain batch, permit handling, gateway actions
├── spraayActionProvider.test.ts
├── schemas.ts                    # Zod schemas and provider config
├── constants.ts                  # Contract address/ABI, gateway endpoints, EIP-2612 types
├── index.ts                      # Public exports
└── README.md                     # This file
```

## Setup

```typescript
import { spraayActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    spraayActionProvider({
      // Max x402 payment per gateway request in whole USDC (default 1.0,
      // or SPRAAY_MAX_GATEWAY_PAYMENT_USDC env var)
      maxGatewayPaymentUsdc: 0.5,
      // Optional pre-funded x402 payment header, sent instead of signing
      // a payment with the wallet provider
      // x402PaymentHeader: process.env.SPRAAY_X402_PAYMENT_HEADER,
    }),
  ],
});
```

## Batch payment actions (direct on-chain)

The agent signs the batch transaction and pays gas itself on Base. All batches are atomic: every transfer succeeds or the whole transaction reverts. Up to 200 recipients per transaction; the protocol fee (default 0.3%, read live from the contract) is added on top. Recipient lists are validated for case-insensitive duplicates before anything is signed.

- `spraay_eth`: Equal ETH amounts to every recipient.
- `spraay_token`: Equal ERC-20 amounts to every recipient.
- `spraay_eth_variable`: Per-recipient ETH amounts.
- `spraay_token_variable`: Per-recipient ERC-20 amounts.

**EIP-2612 permit:** for ERC-20 batches, allowance handling prefers a signed permit when the token supports it (detected at runtime via `nonces()`/`version()` — no hardcoded token list; USDC on Base qualifies). The permit grants an exact, deadline-bounded allowance instead of a standing approve. Non-permit tokens fall back cleanly to `approve`.

**Pre-flight (`preflight: true`):** validates the batch against the free gateway endpoint before signing. An explicit "invalid" verdict aborts before any signature; gateway unavailability never blocks the on-chain path.

## Gateway pre-flight actions (free, no payment)

- `spraay_validate_batch`: `POST https://gateway.spraay.app/free/validate-batch` — validates a batch (BPA 1.0 body; the gateway expects a `recipients` array of `{to, amount}` entries, which the provider maps from its uniform `{recipient, amount}` input) and returns `valid`/`errors`/`warnings`/`summary`.
- `spraay_estimate_batch`: `GET https://gateway.spraay.app/free/estimate-batch?recipients=<count>&chain=<chain>&amount=<total>` — rough gas and protocol-fee estimate for a batch of a given size (the optional total `amount` enables the fee figures).

These make agents safer: validate and cost a batch before signing anything.

## Gateway execution and escrow (x402-metered, paid)

- `spraay_execute_batch_gateway`: `POST https://gateway.spraay.app/api/v1/batch/execute` — the gateway executes the batch (body: `token`, `recipients` as `{address, amount}` entries mapped from the provider's uniform input, and the wallet's address as `sender`); the agent pays a metered USDC fee via the [x402 protocol](https://x402.org) (pricing returned via 402 challenge; `POST /api/v1/batch/estimate` quotes the same way). Multi-chain capable, no gas management for the agent.
- `spraay_create_escrow`: `POST https://gateway.spraay.app/api/v1/escrow/create` — locks funds from a depositor (defaults to the connected wallet) for a beneficiary, with optional arbiter, release conditions, and expiry in hours. Creation only; the gateway's `POST /api/v1/escrow/fund`, `/release`, and `/cancel` endpoints handle the rest of the lifecycle.

Payments are settled either by signing with the wallet provider (`@x402/fetch`) or with a pre-funded `x402PaymentHeader` from config, and are capped by `maxGatewayPaymentUsdc`. Payment is never faked or stubbed.

## Network Support

Base mainnet (`base-mainnet`) only — that is where the batch contract is deployed. Gateway execution is multi-chain capable on the gateway side, but the provider itself registers on Base EVM wallets.

## Notes

- Amounts are whole units (e.g. `"0.01"` ETH, `"100"` USDC); decimals are read from the token contract.
- Works with any `EvmWalletProvider` (CDP EVM wallets, smart wallets, viem wallets). If a wallet cannot sign EIP-712 typed data, permit silently falls back to `approve`.
