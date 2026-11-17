# Agent Data APIs Action Provider

This directory contains the **AgentDataApisActionProvider**, which gives agents pre-trade and pre-payment safety checks from [Agent Data APIs](https://agent-payment-guard.agent-data-apis.workers.dev/llms.txt). Each check is paid per call with [x402](https://x402.org) (USDC on Base) from the agent's own wallet. No API key or account is needed.

## Directory Structure

```
agentDataApis/
├── agentDataApisActionProvider.ts       # Main provider
├── agentDataApisActionProvider.test.ts  # Tests
├── schemas.ts                           # Action schemas and config type
├── index.ts                             # Exports
└── README.md                            # This file
```

## Actions

| Action | Use it | Returns | Price |
|---|---|---|---|
| `check_token_risk` | Before buying, swapping into or accepting a token | `avoid` / `caution` / `ok`; buy/sell tax and round-trip cost from a simulated buy then sell on the token's deepest ETH/WETH pool (Uniswap V2, V3 and V4 plus Aerodrome on Base; Uniswap V2, V3 and V4 on Ethereum), catching honeypots including V4 hooks that confiscate sells; owner powers (mint, pause, blacklist, fee changes, trading switch); proxy; liquidity; sanctioned owner; signed receipt | ~$0.01 |
| `check_payment_counterparty` | Before sending funds to an address (including x402 payTo addresses) | `block` / `review` / `clear`, sanctioned crypto address match (OFAC, UK, EU), x402 seller reputation, live on-chain facts, optional name screening, signed receipt | ~$0.005 |
| `screen_sanctions` | KYC/KYB-style name checks | Scored candidate matches against OFAC (SDN + Consolidated), UN, EU and UK lists | ~$0.01 |

## Configuration

```typescript
import { agentDataApisActionProvider } from "@coinbase/agentkit";

const provider = agentDataApisActionProvider({
  // Maximum USDC the agent may pay for a single check.
  // Default: 0.05 (or AGENT_DATA_APIS_MAX_PAYMENT_USDC env var)
  maxPaymentUsdc: 0.05,
});
```

Before paying, the provider reads the price from the HTTP 402 challenge and refuses to pay if it is above `maxPaymentUsdc` or if no USDC-on-Base option is offered.

## Network Support

The wallet must be on **Base mainnet** (`base-mainnet`), since checks are paid in USDC on Base. The checks themselves cover Base, Ethereum, Arbitrum, Optimism and Polygon addresses and tokens.

## Notes

Results are automated screening signals and simulations at the current block, not financial or legal advice. Contract rules can change after a check (for example through upgrades or owner actions).
