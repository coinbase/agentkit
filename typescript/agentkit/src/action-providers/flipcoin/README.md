# FlipCoin Action Provider

This directory contains the **FlipCoinActionProvider** implementation, which lets an agent trade
on [FlipCoin](https://www.flipcoin.fun) — a LMSR-based prediction-market protocol on Base.

## Directory Structure

```
flipcoin/
├── flipcoinActionProvider.ts       # Main provider implementation
├── flipcoinActionProvider.test.ts  # Jest unit tests
├── constants.ts                    # Base URL, API version, network allow-list
├── schemas.ts                      # Zod input schemas for all 5 actions
├── types.ts                        # FlipCoin API response type definitions
├── index.ts                        # Public exports
└── README.md                       # This file
```

## Actions

- `get_prediction_markets` — list tradable FlipCoin markets (title, conditionId, prices, volume).
  - Filters: `status`, `category`, `limit`, `offset`.
- `get_market_odds` — fetch current YES/NO prices (basis points) and a firm quote for a market.
  - Returns `sharesOut`, `priceImpactBps`, `avgPriceBps`, `quoteId` (valid ~12s).
- `buy_prediction_shares` — buy YES or NO shares with USDC from the agent's vault.
  - Intent → `EvmWalletProvider.signTypedData()` (EIP-712 TradeIntent) → relay broadcast on-chain.
  - Supports `maxSlippageBps` (default 200 = 2%).
- `sell_prediction_shares` — sell YES or NO shares back into the LMSR pool.
  - Requires prior `ShareToken.setApprovalForAll(router, true)` from the trader wallet.
- `get_agent_portfolio` — list the agent's open/resolved positions with net side, entry price
  and unrealized P&L.

## Usage

### 1. Create a FlipCoin API key

Sign in at https://www.flipcoin.fun, open **Settings → Developers**, and generate an API key.
Ensure the key has scopes `portfolio:read` and `trade`.

### 2. Wire it up

```typescript
import {
  AgentKit,
  ViemWalletProvider,
  flipcoinActionProvider,
} from "@coinbase/agentkit";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: base,
  transport: http(),
});

const walletProvider = new ViemWalletProvider(walletClient);

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    flipcoinActionProvider({
      apiKey: process.env.FLIPCOIN_API_KEY!,
    }),
  ],
});
```

### 3. Let the agent trade

The LLM can now call actions like `get_prediction_markets` and `buy_prediction_shares`. A typical
flow:

1. `get_prediction_markets` → pick a market by `conditionId`.
2. `get_market_odds` → preview price, fee, priceImpact for a given USDC amount.
3. `buy_prediction_shares` → execute the trade (wallet signs EIP-712, FlipCoin relayer broadcasts).
4. `get_agent_portfolio` → monitor P&L.

## Prerequisites

- **EVM wallet**: the agent's wallet must be funded with a small amount of USDC on Base, and the
  FlipCoin vault must be seeded via `POST /api/agent/vault/deposit/intent` before trading. The
  wallet is the FlipCoin **trader**, so its address must match the API key's `owner_addr`.
- **Selling** requires the trader wallet to have called `ShareToken.setApprovalForAll(router, true)`
  once per chain. The provider surfaces a structured `approvalRequired` error if it's missing.

## Network Support

- Base Mainnet (`base-mainnet`, chainId 8453)
- Base Sepolia (`base-sepolia`, chainId 84532)

## Configuration

| Option     | Type     | Default                       | Description                                |
| ---------- | -------- | ----------------------------- | ------------------------------------------ |
| `apiKey`   | `string` | —                             | FlipCoin agent API key (required for trades + portfolio). |
| `baseUrl`  | `string` | `https://www.flipcoin.fun`    | Override for staging / self-hosted deployments. |
| `fetchImpl`| `fetch`  | `globalThis.fetch`            | Custom fetch implementation (tests, Node 16, etc.). |

## Notes

- Prices are in basis points: `5000 = 50%`, range `[0, 10000]`.
- USDC uses 6 decimals. All on-wire amounts are integer strings; schemas accept human units
  (e.g. `"5"` = $5).
- The intent is signed with `EvmWalletProvider.signTypedData` (EIP-712). FlipCoin's relayer covers
  gas and broadcasts the transaction.
- Learn more: https://www.flipcoin.fun/docs/agents and https://www.flipcoin.fun/api/openapi.json.
