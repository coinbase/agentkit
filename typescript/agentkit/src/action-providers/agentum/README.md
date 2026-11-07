# Agentum Action Provider

This directory contains the **AgentumActionProvider** implementation, which gives an agent counterparty-verification and compliance actions backed by the [Agentum](https://agentum.asimplek.cloud) API: company resolution against official registries, EU VAT validation, sanctions screening, one-call vendor KYB, IBAN payee checks and OFAC wallet-address screening.

Each call is paid per request in USDC on Base via [x402](https://x402.org), signed by the agent's own wallet. The first 5 calls per day per caller IP address are free and require no payment. No API key or account is needed.

## Directory Structure

```
agentum/
├── agentumActionProvider.ts       # Main provider with the 7 actions
├── agentumActionProvider.test.ts  # Provider test suite
├── schemas.ts                     # Action schemas and config type
├── constants.ts                   # Base URL, endpoints, price cap, supported networks
├── utils.ts                       # x402 payment client and POST helper
├── index.ts                       # Package exports
└── README.md                      # This file
```

## Configuration

All options are optional:

```typescript
import { agentumActionProvider } from "@coinbase/agentkit";

const provider = agentumActionProvider({
  // Highest price in USD the agent may pay for one call. Default: 0.03.
  // A call priced above this is refused before anything is signed.
  maxPriceUsd: 0.03,

  // Server base URL. Default: https://agentum.asimplek.cloud
  baseUrl: "https://agentum.asimplek.cloud",

  // Per-request timeout in milliseconds, including the paid retry. Default: 30000.
  timeoutMs: 30000,

  // Sent as X-Agent-Id so the server can meter the free tier. Default: random per provider.
  agentId: "my-agent",
});
```

## Network and wallet

The provider supports EVM wallet providers on `base-mainnet` only (USDC settles on Base). The wallet that the agent already uses signs an EIP-3009 `transferWithAuthorization` for the exact price, so the agent needs a small USDC balance on Base for paid calls. Free-tier calls cost nothing.

## Actions

| Action              | What it does                                                                  | Price (USDC) |
| ------------------- | ----------------------------------------------------------------------------- | ------------ |
| `resolve_entity`    | Resolve a company to its official registry record (name, number, status, LEI) | 0.005        |
| `verify_eu_vat`     | Validate an EU VAT number against live VIES                                   | 0.005        |
| `screen_sanctions`  | Screen a company or person against OFAC, EU, UN and UK FCDO lists             | 0.005        |
| `check_vendor`      | Registry lookup, VAT check and sanctions screen with a verdict                | 0.010        |
| `verify_bank_payee` | Validate an IBAN (format, MOD-97) and check country against the payee         | 0.003        |
| `batch_resolve`     | Resolve 1 to 25 companies in one call                                         | 0.025        |
| `screen_address`    | Check a wallet address against OFAC's listed digital-currency addresses       | 0.002        |

`batch_resolve` ($0.025) is under the default `maxPriceUsd` of 0.03. Lower `maxPriceUsd` to 0.01 to disable it, or to 0.002 to allow only `screen_address`.

## Limitations

- `screen_address` is an exact match against the official OFAC list only. It is not behavioural, cluster or mixer risk analysis, and `UNKNOWN` does not mean `CLEAR`.
- `resolve_entity` and `batch_resolve` use official registries; some companies in some countries are not resolved.
- Sanctions results are screening aids, not legal determinations.

## Security

Tool results contain text taken from public registries and sanctions lists (company names, addresses, remarks). As with every action that returns third-party text, treat it as untrusted data. See the AgentKit [Managing Risk](../../../../../README.md#%EF%B8%8F-managing-risk) guidance. Payments are bounded per call by `maxPriceUsd`, and the provider only ever contacts the configured `baseUrl`.

## Notes

- Service: https://agentum.asimplek.cloud (OpenAPI at `/openapi.json`, x402 discovery at `/.well-known/x402`).
- The same tools are also available as a remote MCP server at `https://agentum.asimplek.cloud/mcp`.
