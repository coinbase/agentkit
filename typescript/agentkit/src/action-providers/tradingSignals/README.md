# Trading Signals Action Provider

This directory contains the **TradingSignalsActionProvider**, which gives agents pre-trade due diligence on Base and Solana tokens from the [Trading Signals Toolkit](https://signals.incomefather.com). Each call is paid per request over [x402](https://www.x402.org/) in USDC from the agent's own wallet, so no API key or account is required.

## Directory Structure

```
tradingSignals/
├── tradingSignalsActionProvider.ts      # Main provider: actions, x402 payment, result formatting
├── tradingSignalsActionProvider.test.ts # Unit tests
├── schemas.ts                           # Zod input schemas and chain detection
├── constants.ts                         # Base URL, routes, prices, USDC addresses
├── index.ts                             # Main exports
└── README.md                            # This file
```

## Actions

| Action | Price | What it returns |
| --- | --- | --- |
| `token_risk_verdict` | 0.01 USDC | `safe` / `caution` / `avoid` with an A-F grade and reasons: mint and freeze authority, honeypot or sell-tax test, LP lock, top-holder concentration, sniper and bundled wallets, contract flags. |
| `token_pre_trade_pack` | 0.015 USDC | One `GO` / `CAUTION` / `STOP` decision combining the token verdict, an OFAC sanctions screen of the token's authorities and an optional counterparty wallet, and that wallet's USDC pay-readiness. |
| `token_whale_flow` | 0.02 USDC | Whale buys vs sells in USD over 1-24h, net flow and % of liquidity, an accumulation / distribution signal, hourly flow, largest trades, top accumulators and distributors. |

All actions take a `token` (Base `0x...` contract or Solana base58 mint) and an optional `chain` (`base` or `solana`, detected from the address format when omitted). Every result is a JSON string with `status`, a one-line `summary`, `priceUsdc`, payment details (`paidWith`, and for x402 the settlement `transaction` and explorer link) and the full API response in `data`.

## Payment

- The agent's wallet must be on **Base mainnet** or **Solana mainnet** and hold a small USDC balance. Any token chain can be checked from either wallet (for example, check a Solana mint while paying from a Base wallet).
- Payments use the x402 `exact` scheme with the same wallet signers as the [x402 action provider](../x402/README.md), so CDP, Viem, Privy and Solana keypair wallets all work.
- Payments are restricted to USDC on the wallet's network and capped per call (default 0.05 USDC). Routes priced above the cap are refused before any request is made.
- Optional: set `TRADING_SIGNALS_API_KEY` (a free key gives 100 calls / month) to call without a wallet payment. When the key's monthly quota is used up, the provider falls back to x402.

## Configuration

```typescript
import { AgentKit, tradingSignalsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // a Base mainnet or Solana mainnet wallet with a little USDC
  actionProviders: [
    tradingSignalsActionProvider({
      maxPaymentUsdc: 0.05, // optional, per-call cap (env: TRADING_SIGNALS_MAX_PAYMENT_USDC)
      // apiKey: "...",     // optional (env: TRADING_SIGNALS_API_KEY)
    }),
  ],
});
```

## Example

```
Prompt: Before I buy it, is DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 safe? And are whales buying it?

-------------------
token_risk_verdict -> { "status": "success", "summary": "Bonk: SAFE (grade A)", "priceUsdc": 0.01, "paidWith": "x402", ... }
token_whale_flow   -> { "status": "success", "summary": "Whale signal: neutral; 2 buys ($18232) vs 2 sells ($16078), net $2154", "priceUsdc": 0.02, ... }
-------------------
```

## Network Support

Payments: `base-mainnet` and `solana-mainnet`. Tokens analysed: Base and Solana.

## Notes

Results are heuristic risk signals and market data, not financial or legal advice. For API details see the [OpenAPI spec](https://signals.incomefather.com/openapi.json).
