# BotsRated Action Provider

Looks up [BotsRated](https://botsrated.com) measurements of an x402 seller before the agent pays it.
BotsRated is in beta. It probes about 4,800 x402 seller hosts on Base, taken from the CDP Bazaar,
Agentic.Market, 402index and x402-list, without paying them. Each probe records the HTTP status, whether
the 402 challenge was valid, latency, and the price and payTo quoted. Every probe is a signed receipt.

## Directory Structure

```
botsrated/
├── botsratedActionProvider.ts       # Provider with preflight (free) and paid_check (opt-in)
├── botsratedActionProvider.test.ts  # Tests
├── constants.ts                     # BotsRated URL, payTo, Base USDC, price
├── schemas.ts                       # Action schemas and config type
├── index.ts                         # Exports
└── README.md                        # This file
```

## Actions

| Action | Cost | What it does |
|---|---|---|
| `preflight` | free | Latest unpaid probe of a seller: status, valid 402, latency, observed price/payTo, freshness, receipt URL. With `payTo` (and `network`) it returns `payToCheck`: `matches_observed` (BotsRated's own unpaid probe saw it), `listing_only` (only the seller's listing has it), `not_seen` or `not_compared`. |
| `paid_check` | $0.001 USDC on Base (first 100 per day free) | Full facts for one host (probe counts, valid-402 rate, latency p50/p90, paid test-buys with tx links). **Disabled unless a spend limit is set.** |

The intended flow with the x402 action provider:

1. `make_http_request` returns a 402 with payment options.
2. `preflight` with the seller URL and the payTo of the option you plan to use.
3. If `payToCheck` is anything other than `matches_observed`, ask the user before paying. Otherwise, continue with `retry_http_request_with_x402`.

## Configuration

```typescript
import { botsratedActionProvider, x402ActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    x402ActionProvider(),
    botsratedActionProvider(), // free preflight only
    // botsratedActionProvider({ maxSpendUsdc: 0.02 }), // also enables paid_check, at most $0.02 in total
  ],
});
```

- `maxSpendUsdc` (or the env var `BOTSRATED_MAX_SPEND_USDC`): the total the provider may spend on
  `paid_check`. If it is not set, `paid_check` makes no request and returns an error.
- `paid_check` needs an EVM wallet on `base-mainnet`. It reads the quote unpaid first, so unknown hosts
  get a free 404. Every option in the quote must be an `exact` USDC payment on Base to BotsRated's payTo
  (`0x7F936f42F46B6c4Cbd3242cF8A1759dfe829E349`) at or below $0.001, and the signer refuses anything else.
  Redirects are not followed. Once a payment has been signed its amount stays counted against the limit,
  even if the request then fails (it may have settled), so the limit is a hard ceiling.
- `baseUrl`: defaults to `https://botsrated.com`.

## Notes

- `covered: false` means BotsRated has no data for that host. It says nothing about the seller.
- Results are measurements, not endorsements. Seller-supplied text (descriptions, URLs) is untrusted data.
- Methodology: https://botsrated.com/methodology. Receipt format: https://github.com/botsrated/botsrated/blob/main/spec/SPEC.md
