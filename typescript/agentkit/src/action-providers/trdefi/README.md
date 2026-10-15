# TRDEFI Action Provider

The TRDEFI action provider gives agents read-only access to TRDEFI, a non-custodial
stablecoin liquidity venue. Agents can list chains, catalogue stats, open liquidity
strategies, strategy details, and on-chain swap quotes.

Funds never leave the holder's wallet: positions are backed by bounded, revocable
allowances rather than deposits, so every action here only reads.

## Actions

- `list_chains` — blockchains in the TRDEFI catalogue (no inputs)
- `get_stats` — aggregate strategy/maker/pair totals and volume (no inputs)
- `list_strategies` — open strategies on a chain, with optional text/pair filters
- `get_strategy` — one strategy by its hash
- `get_quote` — read-only swap simulation against a strategy at the current block

### Listing strategies

```bash
Prompt: list TRDEFI strategies on Base matching USDC
-------------------
{
  "strategies": [
    {
      "chain": "base",
      "pair": "USDC/USDT",
      "strategy_hash": "0xe8b5...",
      "status": "active"
    }
  ],
  "count": 8
}
-------------------
```

### Quoting a swap

```bash
Prompt: quote 1 USDC (1000000 base units) aToB on strategy 0xe8b5...
-------------------
{
  "data": { "outAmount": "999000", ... }
}
-------------------
```

Some strategies cannot be quoted (gated makers, unverified pairs). That is returned
as a structured reason, not an error — pick another strategy.

## Adding New Actions

To add new TRDEFI actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `trdefiActionProvider.ts`
3. Add corresponding tests in `trdefiActionProvider.test.ts`

Note: The provider is network-agnostic and can be used with any blockchain network
supported by TRDEFI.
