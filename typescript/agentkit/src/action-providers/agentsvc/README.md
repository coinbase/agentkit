# agentsvc Action Provider

This directory contains the **AgentsvcActionProvider**, which gives agents three safety checks from [agentsvc.io](https://agentsvc.io). Each call is paid in USDC over [x402](https://x402.org) from the agent's own wallet. No API key or account is needed.

## Directory Structure

```
agentsvc/
├── agentsvcActionProvider.ts      # Main provider with the three checks
├── agentsvcActionProvider.test.ts # Tests for the provider
├── constants.ts                   # Endpoint, networks and defaults
├── index.ts                       # Main exports
├── README.md                      # This file
└── schemas.ts                     # Action schemas and configuration
```

## Actions

| Action | Service | Price per call |
| --- | --- | --- |
| `check_token_risk` | Token grade A to F from a buy and sell simulation (honeypot, taxes), owner powers, liquidity and age. Base, Ethereum, BSC, Arbitrum, Polygon, Solana. | 0.009 USDC |
| `check_scam_message` | Scam and phishing check for a DM, cast, tweet or email. Every link is checked for domain age, registration, look-alike brand domains, punycode and link shorteners. | 0.003 USDC |
| `check_prompt_injection` | Prompt injection check for untrusted text such as web pages, emails and tool results. | 0.004 USDC |

Failed calls are not charged.

## Configuration

```typescript
import { agentsvcActionProvider } from "@coinbase/agentkit";

const provider = agentsvcActionProvider({
  // Maximum payment per call in whole USDC. Default: 0.05 (or AGENTSVC_MAX_PAYMENT_USDC)
  maxPaymentUsdc: 0.02,
});
```

The provider only pays in USDC, only on the network of the agent's wallet, and never more than `maxPaymentUsdc` per call. Requirements that do not match are dropped before anything is signed.

## Network Support

Base mainnet and Solana mainnet. The wallet needs a small USDC balance; 1 USDC covers about 100 to 300 checks.

## Notes

All results are JSON. Treat a token graded D or F, a message rated `suspicious` or `scam`, and text rated `suspicious` or `malicious` as unsafe. Full service documentation: https://agentsvc.io/docs
