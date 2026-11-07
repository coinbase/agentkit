# Recta Action Provider

This directory contains the **RectaActionProvider**, which gives an agent a free second opinion on a cross-chain
stablecoin transfer before it sends it: can [Recta](https://api.recta.build/llms.txt) prove a cheaper route than the
one the agent would use, at the same chain state?

The provider only reads. It never signs and never sends a transaction, and it needs no API key.

## Directory Structure

```
recta/
├── rectaActionProvider.ts         # Main provider with Recta functionality
├── rectaActionProvider.test.ts    # Test file for Recta provider
├── constants.ts                   # API origin, served networks and declarable routes
├── schemas.ts                     # Action schemas
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `check_route_coverage`: whether Recta covers a corridor from the wallet's network, and which routes it compares.
- `get_route_saving_odds`: how often Recta's recorded decisions found a saving against each route on that corridor.
- `compare_bridge_route`: for a planned transfer and the route the agent would use (`baselineProvider`), whether a
  cheaper route can be proven, its saving (lower bound, USDC) and Recta's fee. Limited to 3 calls a day per address.

## Pricing

The actions here are free. Recta charges exactly 5 % of a saving it verifies on chain, and only after the agent
executes Recta's route; with no saving, the agent keeps its own route and owes nothing. To get and execute a route,
the agent signs a request with [`@recta/client`](https://www.npmjs.com/package/@recta/client) or the
[`@recta/mcp`](https://www.npmjs.com/package/@recta/mcp) server.

## Network Support

EVM sources: Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, BNB Chain, Linea, Unichain, Ink, HyperEVM,
Monad and Arc. Destinations are listed per corridor by `check_route_coverage`.

## Notes

For more information, see Recta's [agent guide](https://api.recta.build/llms.txt).
