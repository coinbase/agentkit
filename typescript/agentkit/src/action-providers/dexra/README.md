# Dexra Action Provider

This provider integrates [Dexra](https://dexra.dev) into AgentKit, so an agent can check Solana token launches, holders, wallets, pools and planned swaps before it trades. Every check returns a verdict (`ok`, `caution`, `avoid` or `unknown`), the reasons behind it, a summary and the evidence.

## Directory Structure

```
dexra/
├── dexraActionProvider.ts        # Main provider with Dexra actions
├── dexraActionProvider.test.ts   # Tests
├── constants.ts                  # API URL
├── schemas.ts                    # Action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Setup

An API key is optional. Without one, `describe_address` is free and the paid checks answer with their x402 price, which the agent can pay per call in USDC on Solana through the [x402 action provider](../x402/README.md).

```typescript
import { AgentKit, dexraActionProvider, x402ActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // a Solana mainnet wallet provider
  actionProviders: [
    dexraActionProvider(), // reads DEXRA_API_KEY if set
    x402ActionProvider({ registeredServices: ["https://api.dexra.dev"] }),
  ],
});
```

With a key from [dexra.dev/app/keys](https://dexra.dev/app/keys) the paid checks are included in the account's daily credits (a confirmed free account gets 100 credits a day):

```typescript
dexraActionProvider({ apiKey: "dxr_..." });
```

## Actions

| Action | Price (USDC) | Description |
|--------|--------------|-------------|
| `describe_address` | free | What a Solana address is (wallet, token, pool, program), its age and activity, and which check to run next |
| `token_deep_check` | 0.03 | Real holders after merging linked wallets, holder and liquidity history, mint authorities and Token-2022 extensions |
| `new_launches` | 0.005 (0.01 over 60 min) | New launches on pump.fun, LetsBonk, Raydium LaunchLab, Meteora DBC, PumpSwap, Raydium AMM and CPMM, with a verdict for each |
| `wallet_check` | 0.03 | Known exchange or not, age, bot or human, launch PnL, sanctions and hack links |
| `pool_health` | 0.03 | Depth, slippage, liquidity flow, LP return after impermanent loss, bot and sandwich share |
| `swap_preflight` | 0.005 | Price impact, sandwich history and Token-2022 traps before a swap |

## Network Support

Solana mainnet (`solana-mainnet`).

## Notes

- API reference: [dexra.dev/docs](https://dexra.dev/docs)
- Track record of the verdicts: [dexra.dev/accuracy](https://dexra.dev/accuracy)
