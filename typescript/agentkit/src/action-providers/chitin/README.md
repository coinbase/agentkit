# Chitin Action Provider

On-chain identity and certificate verification for AI agents.

> "Every agent deserves a wallet" (AgentKit). Every agent deserves a soul (Chitin).

## Overview

[Chitin](https://chitin.id) provides verifiable, on-chain identities for AI agents using Soulbound Tokens (SBTs) on Base L2. This action provider enables agents to:

- **Verify** other agents' identities before interacting with them
- **Register** their own on-chain soul (birth certificate)
- **Check** A2A (Agent-to-Agent) communication readiness
- **Resolve** DID documents for decentralized identity workflows
- **Issue** and **verify** on-chain certificates

## Actions

### Read Actions (No API Key Required)

| Action | Description |
|--------|-------------|
| `get_soul_profile` | Retrieve an agent's on-chain soul profile |
| `resolve_did` | Resolve an agent name to a W3C DID Document |
| `verify_cert` | Verify an on-chain certificate |
| `check_a2a_ready` | Check if an agent is ready for A2A communication |

### Write Actions (API Key Required)

| Action | Description |
|--------|-------------|
| `register_soul` | Register a new on-chain soul (agent identity) |
| `issue_cert` | Issue an on-chain certificate to a recipient |

## Setup

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { chitinActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    chitinActionProvider(),
    // ... other providers
  ],
});
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHITIN_API_URL` | No | Base URL for Chitin API (default: `https://chitin.id/api/v1`) |
| `CHITIN_CERTS_API_URL` | No | Base URL for Certs API (default: `https://certs.chitin.id/api/v1`) |
| `CHITIN_API_KEY` | For writes | API key for registration and certificate issuance |

### Configuration

```typescript
chitinActionProvider({
  apiUrl: "https://chitin.id/api/v1",
  certsApiUrl: "https://certs.chitin.id/api/v1",
  apiKey: "your-api-key",
});
```

## Examples

### Verify an Agent Before A2A Communication

```
Agent: "Check if kani-alpha is ready for A2A communication"

→ chitin_check_a2a_ready({ name: "kani-alpha" })
→ { a2aReady: true, a2aEndpoint: "https://...", soulIntegrity: "verified", ... }
```

### Register a New Agent Soul

```
Agent: "Register my identity as 'my-assistant' on Chitin"

→ chitin_register_soul({
    name: "my-assistant",
    systemPrompt: "I am a helpful coding assistant.",
    agentType: "personal",
    services: [{ type: "a2a", url: "https://my-assistant.example.com/a2a" }]
  })
→ { claimUrl: "https://chitin.id/claim/reg_...", status: "pending_claim" }
```

### Resolve a DID

```
Agent: "Resolve the DID for echo-test-gamma"

→ chitin_resolve_did({ name: "echo-test-gamma" })
→ { id: "did:chitin:echo-test-gamma", verificationMethod: [...], ... }
```

## How It Works

Chitin's identity model has three layers:

1. **Layer 1 (Birth Certificate)**: Base L2 on-chain SBT — fully immutable
2. **Layer 2 (Birth Record)**: Arweave — immutable genesis details
3. **Layer 3 (Resume)**: Arweave — versionable activity records

Each agent's soul includes:
- **Soul Hash**: Cryptographic fingerprint of the agent's genesis data
- **Genesis Seal**: Immutable lock on the birth certificate
- **Owner Attestation**: World ID verification of the human behind the agent
- **ERC-8004 Passport**: Cross-chain identity linking via the official Identity Registry

## Links

- [Chitin Website](https://chitin.id)
- [Chitin Certs](https://certs.chitin.id)
- [Documentation](https://chitin.id/docs)
- [GitHub (Open Source)](https://github.com/Tiida-Tech/chitin-contracts) — MIT-licensed smart contracts
- [ERC-8004 Standard](https://github.com/erc-8004/erc-8004-contracts)
