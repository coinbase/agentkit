# Agent-Mediate Action Provider

This action provider integrates [Agent-Mediate](https://ai-agents-mediation.com) (`@agent-mediate/sdk`) into Coinbase AgentKit so autonomous EVM agents on Base (`base-mainnet` and `base-sepolia`) can resolve commercial, SLA, and `x402r` `AuthCaptureEscrow` disputes in seconds via non-custodial sealed-offer mediation — replacing binary escrow slashing with verifiable multi-issue partial refunds.

## Overview

Agent-Mediate holds **zero custody** of funds. Two agents in a dispute submit principal-bounded, sealed numerical offers across 1–5 quantifiable issues; a deterministic mechanism (`RULES_VERSION 1.4.0`) computes a settlement or fair proposal while keeping confidential walkaways and issue weights private, returning an `Ed25519Signature2026` settlement instruction that downstream `x402r` `AuthCaptureEscrow` operators or AgentKit wallets verify fail-closed before executing on-chain splits.

## Setup

No API key or wallet funding is required to get started — by default the provider connects to `https://api.ai-agents-mediation.com` (`$0.00` waived launch fees) with the pinned production platform `did:key` and mechanism `RULES_HASH`.

```typescript
import { AgentKit, agentMediateActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [agentMediateActionProvider()],
});
```

### Configuration

| Environment Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AGENT_MEDIATE_URL` | No | `https://api.ai-agents-mediation.com` | Agent-Mediate API base URL |
| `AGENT_MEDIATE_PLATFORM_DID` | No | `did:key:z6Mkg7r4aHyPrNKYy1gbWGXu15VgyN9fCbhqKVwftdhHxJ3W` | Out-of-band pinned platform `did:key` |
| `AGENT_MEDIATE_EXPECTED_RULES_HASH` | No | Current SDK `RULES_HASH` (`v1.4.0`) | Pinned 64-char hex mechanism `RULES_HASH` |
| `AGENT_MEDIATE_AGENT_KEY_FILE` | Recommended | Ephemeral in-memory key | Path to persistent Ed25519 PKCS#8 PEM agent identity |

## Actions

| Action | Description |
| --- | --- |
| `check_honours` | Verifies a counterparty domain, `did:web`, or `did:key` on the Agent-Mediate Settlement Honours Roll (`$0.00`). |
| `file_escrow_dispute` | Hashes `x402r` `AuthCaptureEscrow` `PaymentInfo` via RFC 8785 (JCS) into `contractHash` and files a principal-bounded sealed-offer dispute. |
| `submit_offer` | Submits a monotone sealed offer (with private Round-1 `weights` and `walkaway`) and surfaces verbatim `PROPOSAL_DETAILS` JSON on open proposals. |
| `verify_outcome` | Fail-closed verifies the platform-signed `Ed25519Signature2026` settlement instruction against the pinned platform DID, `RULES_HASH`, and `contractHash`, returning exact `refundMicroUsdc` and `merchantReleaseMicroUsdc` split amounts. |

## Network Support

Supports EVM Base networks (`base-mainnet` / chain `8453` and `base-sepolia` / chain `84532`).

## Dependencies

- `@agent-mediate/sdk` — Official Apache-2.0 Agent-Mediate TypeScript SDK

## 15-Second Live Test (Hosted Practice Bot, `$0.00`)

Pass `did:key:z6Mkn42ijWNFD285Ru7xAfVPtVB1LRpmGe5f649fDwxPEanY` as `respondentId` to run a complete end-to-end sealed-offer settlement against the hosted non-binding Practice Counterparty Bot, then verify the signed receipt client-side at https://ai-agents-mediation.com/verify.
