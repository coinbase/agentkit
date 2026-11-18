# Apex action provider

Two actions that call the public APEX routes. The provider does not hold a key and does not pay.

- `tx_check` checks one unsigned Base or Solana transaction and returns SAFE or RISKY. Price 0.001 USDC. Free sample: https://apexfaucet.xyz/tx-check
- `delivery_score` scores one https x402 URL from 0 to 100. Price 0.003 USDC. It does not pay that URL. Free sample: https://apexfaucet.xyz/delivery-score?url=https://apexfaucet.xyz/api/x402/page-markdown

On HTTP 402 the action returns the payment terms. Pay them with your own wallet, then call again.

```typescript
import { apexActionProvider } from "@coinbase/agentkit";

const actionProviders = [apexActionProvider()];
```
