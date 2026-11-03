# PayPerScreen Action Provider

This provider integrates [PayPerScreen](https://payperscreen.com) into AgentKit so an agent can screen who it is dealing with before it pays, onboards or trades: people and companies against official sanctions and export-control lists, crypto wallets, email addresses and IP addresses.

## Overview

Each paid check costs $0.02 in USDC and is paid from the agent's own wallet over the [x402 payment protocol](https://www.x402.org/) on Base, Polygon or Arbitrum. No account or API key is needed. Payment settles only when a result comes back, so bad input or errors cost nothing.

Results are possible matches and signals for a person to review, not a legal determination.

## Setup

No configuration is required. Optional spending caps:

```typescript
import { AgentKit, payperscreenActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    payperscreenActionProvider({
      maxPriceUsd: 0.05, // refuse any single check priced above this
      maxSpendUsd: 1, // stop after spending this much in total
    }),
  ],
});
```

| Option | Environment variable | Default |
|--------|----------------------|---------|
| `apiUrl` | `PAYPERSCREEN_API_URL` | `https://api.payperscreen.com` |
| `maxPriceUsd` | `PAYPERSCREEN_MAX_PRICE_USD` | `0.05` |
| `maxSpendUsd` | `PAYPERSCREEN_MAX_SPEND_USD` | `1` |

## Actions

| Action | Description | Price |
|--------|-------------|-------|
| `screen_name` | Screen a person or company against sanctions and export-control lists (US, UN, EU, UK and more). Fuzzy matching; each possible match compares date of birth, nationality and type. | $0.02 |
| `screen_wallet` | Check a wallet address against OFAC-sanctioned addresses, stablecoin-issuer freezes and wallets tied to major hacks. | $0.02 |
| `check_email` | Email fraud and trust signals: working mailbox, disposable or new domain, lookalikes. | $0.02 |
| `check_ip` | Sanctioned-country, VPN, proxy, Tor, botnet and hosting signals, with country and network owner. | $0.02 |
| `screening_lists_coverage` | Which lists are checked, record counts and last refresh. | Free |

## Wallet and payment

- The wallet needs USDC on Base, Polygon or Arbitrum. No ETH is needed: the payment is a signed USDC authorization and the facilitator pays the gas.
- Only USDC payment options are signed. The agent pays on its own network when offered, otherwise on Base.
- A price above `maxPriceUsd` is refused before anything is signed, and the provider stops once `maxSpendUsd` has been spent.
- Every paid result includes the payment receipt (amount, network, transaction hash).

## Network Support

All EVM networks (payment is made on Base, Polygon or Arbitrum).

## Links

- [Documentation](https://payperscreen.com/docs)
- [Lists checked](https://payperscreen.com/lists)
