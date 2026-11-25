# M2M Sentinel Action Provider

The M2M Sentinel Action Provider equips AgentKit agents with smart contract bytecode analysis, proxy detection, and token capability observations on Base Mainnet.

## Capabilities

- **`audit_contract`**: Return Base Mainnet target contract bytecode capability observations, proxy implementation slot results (EIP-1967/UUPS/Beacon), and known limitations.
- **`get_gas_metrics`**: Get real-time Base network gas metrics and fee recommendations.
- **`get_token_price`**: Observe real-time Base DEX token prices for slippage checks and preflight valuation.
- **`get_service_status`**: Check operational status and trust quorum of M2M Sentinel verification rails.

These are static capability observations, not a safety determination. Results may be incomplete and do not establish runtime reachability; do not treat them as approval to execute a transaction.

## Authentication and payment

An API key is optional and is sent using the `x-api-key` header. `audit_contract` reports HTTP 402 as `PAYMENT_REQUIRED`; the other actions report non-success responses as `ERROR` or `UNAVAILABLE`. This provider does not expose x402 challenge details or sign or settle payments. Use a separate x402 client if payment is required.

## Usage

```typescript
import { AgentKit, m2mSentinelActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    m2mSentinelActionProvider({
      apiKey: process.env.M2M_SENTINEL_API_KEY, // Optional, free tier available at m2msentinel.vercel.app
    }),
  ],
});
```
