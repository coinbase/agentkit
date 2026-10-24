# Token Verdict Action Provider

This directory contains the **TokenVerdictActionProvider** implementation, which gives AI agents a native `token_verdict` action: a pay-per-call token risk screen.

Token Verdict is a live [x402](https://x402.org) service: send a token contract address, get back a verdict (**SOLID / CAUTION / DANGER**), a 0–100 risk score, six weighted market-structure signals, and a written analyst take. It costs **$0.02 USDC per call on Base**, paid automatically from the agent's own wallet provider — no accounts, no API keys.

## Directory Structure

```
tokenVerdict/
├── tokenVerdictActionProvider.ts       # Main provider with the token_verdict action
├── tokenVerdictActionProvider.test.ts  # Test file for the Token Verdict provider
├── schemas.ts                          # Action schema (the service's request contract)
├── constants.ts                        # Service URL, price, and network constants
├── utils.ts                            # x402 paying fetch + spend-guard policy
├── index.ts                            # Main exports
└── README.md                           # This file
```

## Actions

- `token_verdict`: Gets a risk verdict for a token before buying, swapping, or routing funds into it

## Setup

To use the Token Verdict action provider:

```typescript
import { tokenVerdictActionProvider } from "@coinbase/agentkit";

const provider = tokenVerdictActionProvider();

// Or with overrides (e.g. a different service deployment or price guard)
const providerWithOptions = tokenVerdictActionProvider({
  baseUrl: "https://token-verdict-production.up.railway.app", // default
  maxAmountPerPayment: "$0.02", // spend guard, defaults to the known price
});
```

The wallet provider must be an EVM wallet on Base mainnet — payment settles in USDC on Base regardless of which chain's token is analyzed.

## Action Details

### Token Verdict

Gets a risk verdict for a token. The action's arguments mirror the service's real request contract for `POST /v1/verdict`:

| Arg       | Type                                               | Notes                       |
| --------- | -------------------------------------------------- | --------------------------- |
| `address` | `0x...` string (required)                          | Token contract address.     |
| `chain`   | `"base" \| "ethereum" \| "solana"`, default `"base"` | Which token market to analyze. |

Example response:

```json
{
  "token": {
    "address": "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b",
    "symbol": "BASE",
    "name": "Base King",
    "chain": "base"
  },
  "verdict": "CAUTION",
  "score": 35.0,
  "signals": [
    {
      "name": "Liquidity depth",
      "score": 5,
      "weight": 3,
      "detail": "Deep liquidity ($259,106) — the book can absorb real selling."
    }
  ],
  "take": "BASE (Base King) trades at $0.0003238 on uniswap with $259.1k in liquidity...",
  "market": {
    "price_usd": "0.0003238",
    "liquidity_usd": 259106,
    "volume_24h_usd": 0.01,
    "dex": "uniswap"
  }
}
```

(The full response always carries exactly six signals plus the raw market data.)

## How Payment Works

The provider adapts the AgentKit wallet provider into an x402 signer (`EvmWalletProvider.toSigner()` → viem `LocalAccount`) and runs the standard x402 v2 client flow — `@x402/fetch`'s `wrapFetchWithPaymentFromConfig` + `@x402/evm`'s `ExactEvmScheme`, the same client stack AgentKit's own `x402` provider registers:

1. Unpaid `POST /v1/verdict` → HTTP 402 challenge.
2. The client signs an EIP-3009 `TransferWithAuthorization` for $0.02 USDC on Base with the agent wallet and retries with the `PAYMENT-SIGNATURE` header.
3. The service verifies and settles through its facilitator server-side.

A spend guard caps each call at the known price: a payment policy filters the challenge's payment requirements to USDC-on-Base requirements at or under `maxAmountPerPayment` (default `"$0.02"`) before anything is signed, so a repriced or hostile endpoint can never silently charge the agent more.

## Relationship to the Generic x402 Provider

AgentKit already ships a generic [x402 action provider](../x402/README.md) — a general-purpose rail for discovering and calling any x402 endpoint, with raw responses and a confirmation flow. This provider is the complementary piece: a dedicated, typed action for one specific service, with its real request/response contract as a Zod schema, the verdict returned in a form the agent can reason over directly, and the price guard pinned to the service's known price. Builders who prefer the generic route can reach this same endpoint through the `x402` provider today; this provider simply offers the other path.

## Network Support

EVM wallets on Base mainnet only (`supportsNetwork` returns true for `chainId` 8453 / `base-mainnet`).

## Also Available As

- npm: [`token-verdict-agentkit`](https://www.npmjs.com/package/token-verdict-agentkit) — the same provider as a standalone package
- Service: https://token-verdict-production.up.railway.app
- Source: https://github.com/QuincyGB/token-verdict-tools

## Notes

For more information about the x402 protocol, visit the [x402 documentation](https://docs.cdp.coinbase.com/x402/welcome).
