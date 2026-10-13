# GLEE Verifier Action Provider

This directory contains the **GleeVerifierActionProvider** implementation, which provides autonomous software engineering agents with code verification and patch gating actions backed by GLEE's live x402 acceptance verifier ($0.05 USDC on Base mainnet).

## Directory Structure

```
glee-verifier/
├── gleeVerifierActionProvider.ts      # Main provider with x402 verifier integration
├── gleeVerifierActionProvider.test.ts # Unit tests
├── schemas.ts                         # Zod input schemas for patch verification
├── index.ts                           # Module exports
└── README.md                          # Documentation
```

## Actions

- `verify_patch`: Validates a git unified diff patch against declared path policies, security rules, and regex assertions. Settles via native EIP-3009 USDC transfer authorization on Base mainnet. Emits an offline-verifiable cryptographic Ed25519 receipt.

## Usage Example

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { gleeVerifierActionProvider } from "@coinbase/agentkit/action-providers/glee-verifier";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [gleeVerifierActionProvider()],
});

// The agent can now invoke verify_patch to gate pull requests or code edits:
// verify_patch({
//   patch: "diff --git a/src/auth.js b/src/auth.js...",
//   path_policy: { banned_paths: [".env", "config/secrets/"] },
//   assertions: [{ type: "contains", pattern: "validateToken(" }]
// })
```
