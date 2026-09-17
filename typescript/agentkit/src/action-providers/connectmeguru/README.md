# ConnectMeGuru Action Provider

The ConnectMeGuru Action Provider enables AI agents to search and purchase international travel eSIM data plans across 190+ countries with non-custodial USDT payments on Polygon, Arbitrum One, and TRON.

## Actions

- `search_esim_plans`: Search 3,000+ local and regional eSIM packages by destination country.
- `purchase_esim`: Create a non-custodial crypto checkout invoice with collision-free spot discount pricing.
- `check_order_status`: Poll on-chain payment confirmation and retrieve the fulfilled eSIM profile (ICCID, SM-DP+ LPA string, and QR code URL).

## Configuration

```typescript
import { connectmeguruActionProvider } from "@coinbase/agentkit";

const actionProvider = connectmeguruActionProvider({
  patToken: process.env.CMG_PAT_TOKEN, // Optional: Personal Access Token for verified machine identity
  baseUrl: "https://www.connectmeguru.com/api", // Optional: Custom API URL
});
```
