# RugShield Action Provider

The `RugShieldActionProvider` equips autonomous agents with low-latency pre-trade DEX swap simulation, honeypot detection, buy/sell tax calculation, and liquidity depth verification on **Base Mainnet** and **Solana**, monetized via RFC/x402 micropayments.

## Actions Included

1. **`scan_token`**: Comprehensive pre-trade swap simulation and honeypot audit (taxes, liquidity depth, ownership, recommendations).
2. **`check_honeypot`**: Fast boolean honeypot check to ensure tokens can be liquidated.
3. **`token_god_mode`**: Top holder concentration and smart-money orderflow breakdown.

## Usage Example

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { rugshieldActionProvider } from "@coinbase/agentkit/action-providers/rugshield";

const agentkit = await AgentKit.from({
  actionProviders: [
    rugshieldActionProvider(),
  ],
});
```
