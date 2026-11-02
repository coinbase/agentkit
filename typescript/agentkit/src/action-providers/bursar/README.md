# Bursar Action Provider

This directory contains the **BursarActionProvider**, which lets an agent spend from a Bursar mandate: a contract on Robinhood Chain that holds USDG and the limits the agent spends inside, per call, per day, per month, which providers and which capabilities. The contract enforces the limits, so a spend outside them does not settle whatever the agent is told.

## Directory Structure

```
bursar/
├── bursarActionProvider.ts         # Main provider with the four actions
├── bursarActionProvider.test.ts    # Tests
├── schemas.ts                      # Action schemas
├── index.ts                        # Package exports
└── README.md                       # This file
```

## Actions

- `inspect`: Read the mandate: limits, what is left in each window, the balance, the escrow floor and this agent's own cap. Nothing is spent.
- `quote`: Ask the mandate what it would decide about one spend before making it, and which limit stops it.
- `pay`: Pay a provider for one job. The amount is locked in escrow and goes to the provider when it delivers before the deadline; otherwise the funds return to the mandate.
- `settlements`: List what this agent has paid for, newest first, with where each payment stands, or read one settlement by id.

Amounts are USDG in six-decimal units as digit strings: `"250000"` is 0.25 USDG.

## Setup

```typescript
import { AgentKit, ViemWalletProvider, bursarActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,   // on chain 4663, as the mandate's agent
  actionProviders: [
    bursarActionProvider({
      mandate: "0x8605853aC6A64dA11F4ED0Ff0Ad128961Cc3cd5c",
      spendCap: { total: 5_000_000n },   // this agent may spend 5.00 USDG through these actions
    }),
  ],
});
```

The wallet provider has to be the agent the mandate names; it signs, and the mandate pays. A CDP wallet, a Privy wallet or a viem account all work.

## Network Support

Robinhood Chain (chain id 4663) only. A mandate settles in USDG on that chain and nowhere else.

## Notes

- `spendCap` is this agent's own ceiling on top of the mandate's limits, checked before the chain is asked.
- A refusal comes back as a sentence that names the limit and, for a window, when it resets.
- Built on [`@bursar/toolset`](https://www.npmjs.com/package/@bursar/toolset) and [`@bursar/sdk`](https://www.npmjs.com/package/@bursar/sdk). Documentation: [bursar.world](https://bursar.world).
