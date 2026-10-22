# DevX Token Check Action Provider

This provider lets an agent check a token for rug-pull and honeypot risk **before it buys or swaps into it**. It uses [DevX Token Check](https://tokencheck.madebydevx.com), a paid x402 API run by Made by DevX.

## Overview

The service returns a verdict of `safe`, `caution` or `danger`, a risk score, a confidence value and reasons. It reads public on-chain data only:

- **EVM honeypot simulation:** a buy, transfer and sell against the token's pool, with measured taxes.
- **Contract checks:** mint, blacklist, pause, fee setter, proxy/upgradeability and owner status.
- **Market data:** liquidity, holder concentration and contract age.
- **Solana:** mint/freeze authority and Token-2022 extensions. There is no trade simulation on Solana.

Supported chains: Base, Ethereum, Arbitrum, Optimism, Polygon, Robinhood Chain, Solana.

**Pricing:** each check costs **0.01 USDC on Base**. It is paid with x402 from the agent's EVM wallet, which needs a small Base USDC balance. Base USDC, WETH, DEGEN and AERO are checked for free through the demo endpoint. Failed checks (bad input, not a token, RPC failure) are not charged.

**Spend safety:** the provider signs a payment only when the 402 asks for Base USDC, payable to the DevX address `0xe30c4544eC57ac44d8586eB49e49e267fc2d40DB`, at or below `maxPriceUsdc`. Anything else is refused without signing.

Results are informational only, not financial advice. Known gaps: no Uniswap v4 pools, and no full top-holder list on EVM chains.

## Setup

```typescript
import { AgentKit, devxTokenCheckActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    devxTokenCheckActionProvider({
      maxPriceUsdc: "0.01", // spend cap per check
      blockOn: ["danger"], // verdicts that make pre_swap_token_check return proceed=false
      failClosed: false, // return proceed=false when no verdict is available
    }),
  ],
});
```

Set `demoOnly: true` to never pay.

## Actions

| Action                 | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `check_token_risk`     | Returns the verdict, risk score, confidence, reasons and simulated taxes for a token. |
| `pre_swap_token_check` | Returns `{ proceed, reason, verdict }` for the token about to be bought.            |

## Network Support

The provider works with any EVM wallet provider. The token's chain defaults to the wallet's network and can be set per call. Payment is always made in USDC on Base.
