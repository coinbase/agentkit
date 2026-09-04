# M2M Sentinel Action Provider

The M2M Sentinel Action Provider equips AgentKit agents with smart contract bytecode analysis, proxy detection, and token capability observations on Base Mainnet.

## Capabilities

- **`audit_contract`**: Inspect target contract bytecode capability observations, proxy implementation slots (EIP-1967/UUPS/Beacon), and known limitation heuristics in <35ms.
- **`get_gas_metrics`**: Get real-time Base network gas metrics and fee recommendations.
- **`get_token_price`**: Observe real-time Base DEX token prices for slippage checks and preflight valuation.
- **`get_service_status`**: Check operational status and trust quorum of M2M Sentinel verification rails.

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { m2mSentinelActionProvider } from "@coinbase/agentkit/action-providers/m2mSentinel";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    m2mSentinelActionProvider({
      apiKey: process.env.M2M_SENTINEL_API_KEY, // Optional, free tier available at m2msentinel.vercel.app
    }),
  ],
});
```
