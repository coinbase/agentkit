# YourAITools Action Provider

This directory contains the **YourAIToolsActionProvider** implementation. It calls six pay-per-call [x402](https://x402.org) APIs at `https://api.youraitools.co`.

These endpoints are operated by the author of this provider. Each action is priced in USDC per call. Base is the primary network, and the live HTTP 402 response also lists the other networks that endpoint accepts (Polygon, Arbitrum One, and Solana). The provider does not custody funds and does not require an API key.

`payWithWallet` is off by default, so an action returns the endpoint's 402 terms and pays nothing until it is turned on. Each tool also publishes a free preview route (for example `GET /payguard/v1/preview`, rate limited). This provider calls the paid routes, not those previews.

## Directory Structure

```
youraitools/
├── youraitoolsActionProvider.ts       # Provider, 402 parsing, and x402 payment
├── youraitoolsActionProvider.test.ts  # Unit tests (no network, no payment)
├── schemas.ts                         # Zod input schemas and configuration
├── constants.ts                       # Endpoints, list prices, and descriptions
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

| Action | Use it to | Price (USDC/call) |
| --- | --- | --- |
| `payguard_screen_address` | Screen an address against the OFAC SDN list before paying (safety check only, not legal advice) | $0.001 |
| `tokenverdict_check_token` | Check a Base ERC-20 before buying, accepting or approving it (safety check only) | $0.005 |
| `smartperps_smart_money` | See what top Hyperliquid traders hold for a coin (read-only; Not financial advice. Past performance does not guarantee future results.) | $0.003 |
| `toolpick_find_paid_api` | Find which paid x402 API to call for a task | $0.003 |
| `webread_read_url` | Read a public page as clean Markdown | $0.002 |
| `injectscan_scan_text` | Scan untrusted text for prompt injection (safety check only) | $0.003 |

## Usage

```typescript
import { AgentKit, youraitoolsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [youraitoolsActionProvider({ payWithWallet: true, maxPriceUsd: 0.005 })],
});
```

- `payWithWallet` (default `false`): when off, actions return the endpoint's 402 terms (price, networks, pay-to) and nothing is paid. When on, the AgentKit wallet signs the x402 USDC payment through the same `@x402/fetch` client as `x402ActionProvider`.
- `maxPriceUsd` (default `0.01`): actions whose list price is above it are refused before any request.
- `creditsKey`: optional prepaid key from https://api.youraitools.co/credits/ (sent as `Authorization: Bearer`). When set, the wallet is not asked to pay.

Bad input is rejected with HTTP 400 before the paywall and is not charged. Decision guide: https://api.youraitools.co/docs/which-api
