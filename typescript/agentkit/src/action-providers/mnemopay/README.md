# MnemoPay Action Provider

This directory contains the **MnemoPayActionProvider** implementation, which gives AI agents **economic memory** through the [MnemoPay SDK](https://www.npmjs.com/package/@mnemopay/sdk). Agents can remember payment outcomes, learn from settlements and refunds, and build reputation over time.

## Directory Structure

```
mnemopay/
├── mnemopayActionProvider.ts         # Main provider with MnemoPay functionality
├── mnemopayActionProvider.test.ts    # Test file for MnemoPay provider
├── schemas.ts                        # MnemoPay action schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `remember_outcome` - Store a memory about a payment outcome, provider interaction, or economic event
- `recall_memories` - Recall memories by semantic query, ranked by similarity and importance
- `charge_payment` - Charge a payment and create an escrow
- `settle_payment` - Settle a payment (positive reinforcement: +0.05 reputation)
- `refund_payment` - Refund a payment (negative reinforcement: -0.05 reputation)
- `check_balance` - Check the agent's wallet balance and reputation score
- `agent_profile` - Get the agent's full profile including memory statistics

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { mnemoPayActionProvider } from "@coinbase/agentkit";

const agentkit = new AgentKit({
  // ... your config
  actionProviders: [
    mnemoPayActionProvider({
      agentId: "my-trading-agent",
      decayRate: 0.05,
    }),
  ],
});
```

## Configuration

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `agentId` | `MNEMOPAY_AGENT_ID` | `"default-agent"` | Unique identifier for the agent |
| `decayRate` | `MNEMOPAY_DECAY_RATE` | `0.05` | Memory decay rate (0.0-1.0) |

## How Economic Memory Works

1. **Remember**: Agent stores memories about interactions (provider quality, payment outcomes, patterns)
2. **Recall**: Agent queries memories semantically to inform decisions
3. **Charge**: Agent initiates a payment, creating an escrow
4. **Settle**: If the outcome was good, settling reinforces the memories that led to the decision (+0.05 reputation)
5. **Refund**: If the outcome was bad, refunding weakens those memories (-0.05 reputation)

Over time, the agent builds a reputation score and learns which economic decisions lead to good outcomes.

## Network Support

The MnemoPay provider is network-agnostic. It operates at the application layer and works with any blockchain network.

## Dependencies

- `@mnemopay/sdk` - The MnemoPay TypeScript SDK

For more information, visit the [MnemoPay documentation](https://github.com/t49qnsx7qt-kpanks/mnemopay-sdk).
