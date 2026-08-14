# Agent Guild Action Provider

The Agent Guild provider lets an AgentKit agent quote and purchase trust decisions
immediately before delegation or payment. It uses Agent Guild's public x402 v2
service on Base mainnet and requires no Agent Guild account or API key.

## Safety model

- Quote actions never create a payment.
- Purchase actions require the exact x402 option returned by the matching quote,
  plus `confirmPayment: true`.
- The live 402 must still match the selected scheme, Base network, USDC asset,
  amount, payee, timeout, extra fields, and exact resource URL before a payment
  payload can be created.
- `maxPaymentUsdc` is a hard per-request ceiling and defaults to `0.01` USDC.
- An overridden `baseUrl` is quote-only unless the developer also sets
  `allowPaymentsToOverriddenBaseUrl: true`. The model cannot change either option.
- A changed or ambiguous live quote fails closed before signing.

## Usage

```typescript
import { agentGuildActionProvider } from "@coinbase/agentkit";

const provider = agentGuildActionProvider({
  maxPaymentUsdc: 0.01,
});
```

The provider supports Base mainnet EVM wallets.

## Actions

### `quote_agent_trust`

Returns the current unpaid x402 quote for a capability trust decision. Set
`signed: true` for an offline-verifiable AGD-1 decision; signed decisions may cost
more than the default cap.

### `purchase_agent_trust`

Retries the same trust request with one exact option from `quote_agent_trust`.
The action pays only when the live quote is unchanged and within the configured cap.

### `quote_payment_safety`

Returns the unpaid quote for an AGPD-1 decision bound to the contemplated Base
USDC payment: token, atomic amount, payee, resource URL, optional capability, and
risk thresholds.

### `purchase_payment_safety`

Purchases the exact quoted AGPD-1 decision. Before signing the protected payment,
verify the returned credential and require its decision to be `allow`, its proof to
be valid and fresh, and its sealed request to match the intended payment.
The Agent Guild fee for this decision is capped directly by this provider and is
not recursively passed through the payment-safety action.

Portable credentials can be rechecked without payment using
`POST /wallet-binding/decision/verify`.

Agent Guild's verification and discovery routes are documented at
`https://agent-guild-5d5r.onrender.com/openapi.json`.
