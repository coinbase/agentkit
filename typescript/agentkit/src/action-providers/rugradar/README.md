# RugRadar Action Provider

This directory contains the RugRadar action provider, which gives agents read-only Solana token rug and scam risk checks and wallet-drainer link scans through the [RugRadar](https://rugradar-bgcm.onrender.com/agents) API.

It needs no wallet and sends no transactions, so a Solana trading agent can screen a token before swapping into it (for example before a Jupiter swap).

## Directory Structure

```
rugradar/
├── constants.ts                   # API base URL and limits
├── rugradarActionProvider.test.ts # Tests for the provider
├── rugradarActionProvider.ts      # Main provider
├── index.ts                       # Main exports
├── README.md                      # Documentation
├── schemas.ts                     # Action input schemas
└── types.ts                       # Config and API response types
```

## Actions

- `check_solana_token_risk`: Check a Solana token by mint address, pump.fun or DexScreener link, or $TICKER

  - Returns a 0-100 risk score (0-29 low risk, 30-59 caution, 60-100 high risk)
  - Lists the main signals: mint/freeze authority, Token-2022 extensions, holder concentration, dev wallet launch history, linked insider wallets, LP lock and a honeypot sell test
  - Includes a link to the full public report

- `scan_link_for_drainer`: Scan a URL or pasted post text for wallet-drainer and phishing patterns
  - Returns a 0-100 danger score and the reasons (lookalike domains, claim/airdrop bait, risky hosting)

Results are automated risk signals, not financial advice. A low score does not mean a token is safe to buy.

## Configuration

No API key is needed. The free tier allows 5 token checks and 20 link scans per day per IP. For unlimited checks, pass a RugRadar Pro key:

```typescript
import { rugradarActionProvider } from "@coinbase/agentkit";

const provider = rugradarActionProvider(); // free tier
// or
const provider = rugradarActionProvider({ apiKey: process.env.RUGRADAR_API_KEY });
```

The key can also be set with the `RUGRADAR_API_KEY` environment variable.

## Network Support

RugRadar is a plain HTTP API that needs no wallet, so the provider works with any wallet provider and network. The tokens it checks are on Solana mainnet.

## Examples

```
Prompt: Is DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 a rug?

-------------------
RugRadar risk check for Bonk (Bonk), mint DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
Risk score: 0/100 (Low risk)
Summary: No major red flags found. Still a crypto asset — not a guarantee.
Signals:
- [info] Top 10 wallets hold 38.45% (for large tokens these are usually exchanges and treasuries).
- [good] Mint authority revoked — no new supply can be created.
- [good] Freeze authority revoked — nobody can freeze your tokens.
...
Full report: https://rugradar-bgcm.onrender.com/t/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
-------------------
```
