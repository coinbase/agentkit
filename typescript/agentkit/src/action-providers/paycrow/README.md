# PayCrow Action Provider

The PayCrow action provider integrates [PayCrow](https://github.com/michu5696/paycrow) trust-informed escrow payments into AgentKit. PayCrow is a trust layer for agent-to-agent payments that protects buyers by checking seller reputation before paying and holding funds in escrow until services are delivered.

## Actions

### trust_gate

Check an agent or seller's trust score before making a payment. Returns a decision (`proceed`, `caution`, or `block`), a recommended timelock duration, and a maximum recommended payment amount.

### safe_pay

Make a trust-informed escrow payment. Combines trust checking and escrow creation into a single action. The escrow protects the buyer by holding funds until the service is delivered.

### escrow_create

Create a USDC escrow with a configurable timelock. Funds are held until service delivery is confirmed or the timelock expires.

### rate_service

Rate a completed escrow (1-5 stars). Ratings contribute to the seller's on-chain trust score, which affects future `trust_gate` decisions.

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { paycrowActionProvider } from "@coinbase/agentkit";

const agent = new AgentKit({
  actionProviders: [paycrowActionProvider()],
});
```

## Network Support

PayCrow's trust API is network-agnostic and works across all networks.

## Links

- [PayCrow GitHub](https://github.com/michu5696/paycrow)
- [PayCrow npm](https://www.npmjs.com/package/paycrow)
- [Trust API](https://paycrow-app.fly.dev)
