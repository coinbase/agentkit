# Stablecoin Gateways Action Provider

Pre-payment lookups an agent can run before it pays someone. Each action is a GET against a pay-per-call [x402](https://www.x402.org) v2 endpoint at `https://api.stablecoingateways.com`. The agent's own wallet pays in USDC on Base. There is no API key.

Results are neutral sourced facts, not a compliance determination. Individuals are not screened.

Service description and field reference: [https://api.stablecoingateways.com/llms.txt](https://api.stablecoingateways.com/llms.txt).

## Configuration

```typescript
import { stablecoinGatewaysActionProvider } from "@coinbase/agentkit";

const provider = stablecoinGatewaysActionProvider({
  // Optional. Default: https://api.stablecoingateways.com
  baseUrl: "https://api.stablecoingateways.com",
  // Optional per-call cap in whole USDC. Default: 0.05
  maxPaymentUsdc: 0.05,
});
```

Before the wallet signs, the provider reads the unpaid `402` quote and refuses the call when:

- the USDC amount on the wallet's network is above `maxPaymentUsdc`, or
- that network has no USDC option (other assets in the same quote, such as XRP, are not paid).

USDC is settled on Base mainnet (`eip155:8453`) through the Coinbase CDP x402 facilitator. Base Sepolia (`eip155:84532`) is accepted for testing. The provider only supports `base-mainnet` and `base-sepolia`.

## Actions

| Action | Method and path | Published price | What it returns |
| --- | --- | --- | --- |
| `screen_crypto_address` | `GET /v1/sanctions/address?address=` | $0.002 USDC | Whether the address is on OFAC's published list of sanctioned digital currency addresses |
| `counterparty_check` | `GET /v1/counterparty-check?name=&domain=&lei=&vat=&country=&address=` | $0.01 USDC | KYB preflight facts on a business: OFAC, EU, and UK sanctions screen of the company name (UN designations flagged), OFAC wallet check, GLEIF LEI match, domain age / registrar / email auth, EU VAT format check |
| `merchant_check` | `GET /v1/merchant-check?domain=&name=&ticker=&lei=&country=` | $0.01 USDC | Domain age and email-auth posture, OFAC name screen, LEI and SEC matches |

`counterparty_check` needs at least one of `name`, `domain`, `lei`, or `address`. `merchant_check` requires `domain`.

Every action tells the agent: results are neutral sourced facts, not a compliance determination; individuals are not screened.

A successful payment returns JSON:

```json
{
  "success": true,
  "data": {},
  "paymentTxHash": "0x..."
}
```

`data` is the endpoint body. `paymentTxHash` is the `transaction` field of the `PAYMENT-RESPONSE` header.

## Networks

| AgentKit network | x402 network | USDC |
| --- | --- | --- |
| `base-mainnet` | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `base-sepolia` | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Disclaimer

These lookups report sourced facts (US Treasury OFAC, European Commission, UK FCDO, GLEIF, registry RDAP, SEC EDGAR). They are not a compliance determination, a risk score, or a decision to pay. Individuals are not screened. The agent still has to decide what to do with the facts.
