# Bolyra Action Provider

ZKP-based agent identity verification and scoped delegation for AgentKit.

## What It Does

Gives AgentKit agents the ability to prove their identity and permissions using zero-knowledge proofs. Complements ERC-8004 (on-chain registry identity) with off-chain portable identity that works across any network.

## Actions

| Action | Description |
|--------|-------------|
| `create_identity_proof` | Generate a ZKP credential proving this agent's identity and permissions |
| `verify_identity_proof` | Verify another agent's proof envelope and check required permissions |

## Setup

```bash
npm install @bolyra/sdk
```

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { bolyraActionProvider } from "@coinbase/agentkit/action-providers/bolyra";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    bolyraActionProvider({ operatorSecret: parseInt(process.env.OPERATOR_SECRET!) }),
  ],
});
```

## Permissions

The 8-bit cumulative permission model:

| Permission | Bit | Scope |
|-----------|-----|-------|
| `read_data` | 0 | Read access |
| `write_data` | 1 | Write access |
| `financial_small` | 2 | Spend < $100 |
| `financial_medium` | 3 | Spend < $10K (implies financial_small) |
| `financial_unlimited` | 4 | Unlimited (implies financial_medium + small) |
| `sign_on_behalf` | 5 | Sign as the operator |
| `sub_delegate` | 6 | Delegate to other agents |
| `access_pii` | 7 | Access personal data |

Delegation can only narrow permissions, never expand. Enforced by the ZKP circuit.

## Network Support

All networks. Bolyra proofs are off-chain ZKP, network-agnostic.

## Links

- [@bolyra/sdk on npm](https://www.npmjs.com/package/@bolyra/sdk)
- [Bolyra GitHub](https://github.com/bolyra/bolyra)
- [Live demo](https://bolyra.ai/playground)
