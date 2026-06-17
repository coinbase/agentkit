# AgentRadar Action Provider

This directory contains the AgentRadar action provider implementation, which provides actions to check the on-chain trust of an AI agent or wallet via the [AgentRadar](https://api.vvpro.ai) API before interacting with or paying it.

AgentRadar computes a composite trust score from ERC-8004 reputation, a scam-wallet database, and static analysis. The provider is **network-agnostic**, **read-only**, and requires **no API key**.

## Directory Structure

```
agentradar/
├── agentRadarActionProvider.ts      # Main provider with AgentRadar API functionality
├── agentRadarActionProvider.test.ts # Tests for the provider
├── constants.ts                     # API base URL and constants
├── index.ts                         # Main exports
├── README.md                        # Documentation
├── schemas.ts                       # AgentRadar action schemas
└── types.ts                         # Type definitions
```

## Actions

- `verify_agent`: Check an agent or wallet's trust score before interacting or paying

  - Returns a composite trust score (0-100) and a verdict (`TRUSTED`, `VERIFIED`, `CAUTION`, `RISKY`, or `BLOCKED`)
  - Returns per-signal scores (identity, reputation, scam detection, and more)
  - Returns a descriptive error message on invalid input or request failure

- `get_trust_badge`: Get an embeddable AgentRadar trust-badge image URL (SVG)
  - Accepts an address and an optional style (`flat`, `pill`, or `detailed`)
  - Returns a URL pointing to the badge SVG

## Usage

```typescript
import { agentRadarActionProvider } from "@coinbase/agentkit";

const provider = agentRadarActionProvider();
```

Register it with AgentKit:

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { agentRadarActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [agentRadarActionProvider()],
});
```

## Examples

### Verifying an Agent

```
Verify 0x036CbD53842c5426634e7929541eC2318f3dCF7e before I pay it.
```

### Getting a Trust Badge

```
Get the AgentRadar trust badge for 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
```

## Notes

- The provider calls the public AgentRadar API at `https://api.vvpro.ai`. No credentials are required.
- For more details, see the [AgentRadar API](https://api.vvpro.ai).
```
