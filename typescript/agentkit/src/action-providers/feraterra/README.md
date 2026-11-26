# FeraTerra Action Provider

This directory contains the **FeraterraActionProvider** implementation, enabling AI agents to interact with **FeraTerra** (`https://testnet.feraterra.app`), a headless central limit order book (CLOB) and cross-margin execution venue settled on Base Sepolia (`chain_id=84532`).

## Directory Structure

```
feraterra/
├── constants.ts                    # Default gateway URL, Base Sepolia constants, fixed-point scales
├── feraterraActionProvider.ts      # Main provider with FeraTerra actions
├── feraterraActionProvider.test.ts # Unit tests for FeraTerra provider
├── index.ts                        # Public exports
├── README.md                       # Documentation
├── schemas.ts                      # Zod action input schemas
└── types.ts                        # TypeScript interfaces
```

## Actions

- `get_markets`: List active Spot, Perp, SpreadBook, and BoundedClaim markets and risk specifications (`GET /markets`)
- `get_orderbook`: Fetch aggregated L2 orderbook levels and BBO spread (`GET /book`)
- `get_leaderboard`: Query the public Gladiator leaderboard ranked by equity, PnL, maker BBO streak, volume, or ROI (`GET /leaderboard`)
- `preview_order`: Run a zero-mutation order preview via authenticated `POST /order/preview` (when API credentials are configured) or stateless L2 sweep and BBO spread simulation (`GET /book`)
- `request_testnet_faucet`: Request Base Sepolia (`chain_id=84532`) testnet collateral tokens and optional ETH gas drip for `walletProvider.getAddress()` (`POST /faucet`)

## Setup

No extra dependencies or API keys are required for market discovery, L2 orderbooks, leaderboard queries, BBO order previews, or Base Sepolia testnet faucet requests:

```typescript
import { AgentKit, feraterraActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [feraterraActionProvider()],
});
```

Optional API credentials can be supplied for authenticated Eigen-SPAN margin dry-runs (`POST /order/preview`):

```typescript
import { feraterraActionProvider } from "@coinbase/agentkit";

const provider = feraterraActionProvider({
  baseUrl: "https://testnet.feraterra.app",
  apiKey: process.env.FERATERRA_API_KEY,
  apiSecret: process.env.FERATERRA_API_SECRET,
  accountId: 1010,
});
```

## Fixed-Point Units

- `priceTicks`: `1 tick = $0.01 USD` (`$60,000.00 = 6,000,000 ticks`)
- `qtyLots`: `1 lot = 0.0001` base units (`1.0000 BTC = 10,000 lots`)
- `usdMicro`: `1 USD = 1,000,000 usd_micro`

## Network Support

Market discovery, L2 orderbook snapshots, Gladiator leaderboard queries, and order previews are network-agnostic. `request_testnet_faucet` requires an EVM wallet connected to **Base Sepolia** (`base-sepolia`, `chain_id=84532`).
