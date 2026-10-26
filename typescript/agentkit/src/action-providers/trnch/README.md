# TRNCH Action Provider

Trade new Robinhood Chain tokens through [TRNCH](https://trnch.fun): a live feed of launches screened by TIA (rugs, honeypots, scam contracts, heavy sell taxes and copycats kept out) and the best route across six routers. Non-custodial: every transaction is sent by your wallet.

## Actions

- `get_trnch_stats`: live numbers for the last 24 hours (tokens spotted, kept out, rugs detected, median detection delay)
- `get_trnch_heat`: the live feed of screened launches, each token as an opaque id
- `trnch_buy`: buy a token with USDG, best of six routers
- `trnch_sell`: sell a percent of the balance for USDG

## Configuration

```typescript
import { trnchActionProvider } from "@coinbase/agentkit";

const provider = trnchActionProvider(); // or trnchActionProvider({ apiKey: process.env.TRNCH_API_KEY, ref: process.env.TRNCH_REF })
```

`ref` (or `TRNCH_REF`) is your TRNCH referral code: every swap made with a key the provider creates pays you a share of the TRNCH fee.

Without an API key, one is created on first use by signing a message with the wallet (no funds move). The wallet needs 10 USDG or 0.004 ETH on Robinhood Chain.

## Network Support

Robinhood Chain (chainId 4663) only. 0.5% fee per swap, already deducted from the quotes. Docs: https://trnch.fun/bot
