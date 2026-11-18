# VDM Nexus Action Provider

This directory contains the **VdmNexusActionProvider** implementation, which exposes [VDM Nexus](https://vdmnexus.com) — a signed-inference rail — as a tool surface inside any AgentKit-built agent.

Every paid `nexus_chat` call settles a USDC payment inline via [x402](https://github.com/coinbase/x402) and returns the OpenAI chat completion alongside a Signed Inference Receipt ([SIR v2](https://docs.vdmnexus.com/docs/spec/sir-v2)) anchored to the on-chain settlement transaction. Receipts are independently verifiable — a third party can confirm what the model returned without trusting the caller or the service operator.

First mainnet receipt: <https://vdmnexus.com/r/c9710ea7-9e1f-46ee-aaa9-903a536ae12e>

## Directory Structure

```
vdm-nexus/
├── vdmNexusActionProvider.ts          # Main provider with the three actions
├── vdmNexusActionProvider.test.ts     # Jest tests
├── schemas.ts                         # Zod input schemas
├── index.ts                           # Public exports
└── README.md                          # This file
```

## Usage

```typescript
import { AgentKit, SolanaKeypairWalletProvider } from "@coinbase/agentkit";
import { vdmNexusActionProvider } from "@coinbase/agentkit";

const walletProvider = await SolanaKeypairWalletProvider.fromNetwork(
  "solana-mainnet",
  process.env.SOLANA_PRIVATE_KEY!,
);

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [vdmNexusActionProvider()],
});
```

The wallet attached to AgentKit IS the agent identity — its keypair signs the SPL USDC transfer carried in the x402 `X-Payment` header. No separate agent secret env var is required.

## Configuration

```typescript
vdmNexusActionProvider({
  // Point at a different deployment (e.g. self-hosted)
  endpoint: "https://nexus.example.com/api/v1",

  // Pin the operator pubkey for offline verification. When omitted, the
  // verifier fetches it from `${endpoint}/operator-key` on first use.
  operatorKey: "<base58 Ed25519 pubkey>",
});
```

## Actions

### `nexus_chat`

Pay-per-call signed inference. Performs the x402 two-roundtrip handshake (probe → sign → paid), runs the inference upstream, and returns the OpenAI chat completion plus the SIR v2 receipt and the settlement record.

**Inputs:** `model`, `messages`, optional `network` override.

**Returns:** `{ ok, openai, receipt, payment }` on success; `{ ok: false, error, ... }` on failure.

### `nexus_verify_receipt`

Run the five-check SIR v2 verifier against a receipt, prompt, and response. Confirms:

1. `prompt_hash_ok` — sha256(prompt) matches `receipt.prompt_hash`
2. `response_hash_ok` — sha256(response) matches `receipt.response_hash`
3. `nexus_signature_ok` — operator Ed25519 signature is valid
4. `payment_on_chain_ok` — settlement tx landed at the recipient
5. `payer_matches` — tx payer equals `receipt.agent_pubkey`

**Returns:** `{ ok, checks }` with the full breakdown so the agent can act on partial failures.

### `nexus_get_deposit_address`

Fetch the on-chain USDC deposit address for prepaid credit top-ups. Per-call x402 settlement via `nexus_chat` does **not** require this — it settles inline. Use this only when batching deposits is cheaper than per-call settlement (high-volume agents).

**Returns:** `{ ok, address, mint, network }`.

## Network Support

| Network | CAIP-2 | Status |
|---|---|---|
| Solana mainnet | `solana:mainnet` | Live |
| Solana devnet | `solana:devnet` | Live |

`supportsNetwork` returns true for any SVM (`network.protocolFamily === "svm"`) network. An EVM-bound sibling provider for Base mainnet/Sepolia settlement is on the roadmap.

## Why signed inference?

- **Audit trails.** Every inference call produces a tamper-evident receipt the caller can verify cryptographically. Useful for compliance regimes that require evidence of what a model returned (EU AI Act Article 12, NIST AI agent standards, OWASP LLM Top 10 logging).
- **Trustless multi-agent flows.** Agent A can hand Agent B a receipt; Agent B can verify it without trusting Agent A — the operator's Ed25519 signature plus the on-chain settlement record are the trust anchor.
- **Pay-per-call autonomy.** No prepaid balance to babysit. The wallet pays inline.

## Specification

The Signed Inference Receipt v2 wire format and verification rules are documented at <https://docs.vdmnexus.com/docs/spec/sir-v2>.

## Relationship to the existing `x402` action provider

The upstream [`x402` action provider](../x402/README.md) is a general-purpose client for calling any x402-protected API. `vdm-nexus` is a higher-level adapter targeting one specific x402 rail (Nexus) and adding the verifiable-receipt semantics on top — the wire-level handshake is the same, but the receipt verification, model selection, and OpenAI response shape are specific to the Nexus deployment. Use `x402` when you want to call arbitrary paid APIs; use `vdm-nexus` when you specifically want paid LLM inference with cryptographic receipts.
