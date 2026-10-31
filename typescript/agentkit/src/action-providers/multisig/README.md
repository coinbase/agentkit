# Multisig Action Provider

Enable AgentKit agents to participate in multi-agent multisig wallets.

## Overview

This action provider allows AgentKit agents to:
- Sign digests for external multisig coordination
- Sign Safe (Gnosis Safe) transaction hashes
- Share their public key with multisig coordinators

## Use Cases

### Multi-Agent Treasuries

Multiple AI agents from different providers can share a multisig wallet:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ AgentKit │    │   aibtc  │    │Claw Cash │
│  Agent   │    │  Agent   │    │  Agent   │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
              ┌──────▼──────┐
              │   2-of-3    │
              │  Multisig   │
              │   (Safe)    │
              └─────────────┘
```

### Cross-Provider Coordination

The coordination flow:
1. Each agent registers their public key with a coordinator
2. Coordinator generates a multisig address
3. Anyone can fund the multisig
4. When spending, coordinator creates a transaction proposal
5. Each agent validates and signs their portion
6. Coordinator assembles signatures and broadcasts

## Actions

### `sign_digest`

Signs a raw 32-byte digest for external coordination protocols.

```typescript
const result = await agent.run({
  action: "sign_digest",
  args: {
    digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
});
```

**Security:** Only sign digests after validating the full transaction details from the coordinator.

### `sign_safe_transaction`

Signs a Safe (Gnosis Safe) transaction hash.

```typescript
const result = await agent.run({
  action: "sign_safe_transaction",
  args: {
    safeAddress: "0x...",
    safeTxHash: "a1b2c3d4..."
  }
});
```

### `get_multisig_pubkey`

Gets the agent's public key for registering with a multisig.

```typescript
const result = await agent.run({
  action: "get_multisig_pubkey",
  args: {}
});
```

## Integration Example

With [Agent Multisig Coordination API](https://github.com/aetos53t/agent-multisig-api):

```typescript
import { AgentKit, multisigActionProvider } from "@coinbase/agentkit";

// Initialize agent with multisig actions
const agent = new AgentKit({
  actionProviders: [multisigActionProvider()]
});

// 1. Get public key for registration
const pubkeyResult = await agent.run({ action: "get_multisig_pubkey" });

// 2. Register with coordination API
await fetch("https://api.agentmultisig.dev/v1/agents", {
  method: "POST",
  body: JSON.stringify({
    id: "my-agent",
    publicKey: pubkeyResult.address,
    provider: "agentkit"
  })
});

// 3. When a proposal needs signing, sign the digest
const signResult = await agent.run({
  action: "sign_digest",
  args: { digest: proposalSighash }
});

// 4. Submit signature to coordinator
await fetch(`https://api.agentmultisig.dev/v1/proposals/${id}/sign`, {
  method: "POST",
  body: JSON.stringify({
    agentId: "my-agent",
    signature: signResult.signature
  })
});
```

## Security Considerations

1. **Never blind sign**: Always validate the full transaction before signing a digest
2. **Verify coordinators**: Only work with trusted coordination protocols
3. **Check transaction details**: Ensure inputs, outputs, and amounts are correct
4. **Use threshold signing**: M-of-N schemes protect against single point of failure

## Supported Networks

Currently supports EVM networks (Ethereum, Base, Arbitrum, etc.). Solana support planned.

## Related

- [Agent Multisig Coordination API](https://github.com/aetos53t/agent-multisig-api) - Coordination layer
- [Safe Protocol](https://docs.safe.global/) - EVM multisig standard
- [aibtc MCP Server](https://github.com/aibtcdev/aibtc-mcp-server) - Bitcoin agent integration
