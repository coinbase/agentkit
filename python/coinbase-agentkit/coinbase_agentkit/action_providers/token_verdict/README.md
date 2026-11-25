# Token Verdict Action Provider

This directory contains the **TokenVerdictActionProvider** implementation, which gives AI agents a native `token_verdict` action: a pay-per-call token risk screen.

Token Verdict is a live [x402](https://x402.org) service: send a token contract address, get back a verdict (**SOLID / CAUTION / DANGER**), a 0–100 risk score, six weighted market-structure signals, and a written analyst take. It costs **$0.02 USDC per call on Base**, paid automatically from the agent's own wallet provider — no accounts, no API keys.

This is the Python parity provider for the TypeScript implementation in [coinbase/agentkit#1598](https://github.com/coinbase/agentkit/pull/1598); behavior, pricing guard, and error contract are identical.

## Directory Structure

```
token_verdict/
├── token_verdict_action_provider.py   # Main provider with the token_verdict action
├── schemas.py                         # Action schema (the service's request contract)
├── constants.py                       # Service URL, price, and network constants
├── utils.py                           # x402 paying session + spend-guard policy
├── __init__.py                        # Package marker
└── README.md                          # This file

# From python/coinbase-agentkit/
tests/action_providers/token_verdict/
├── conftest.py                              # Test configuration
└── test_token_verdict_action_provider.py    # Tests for the Token Verdict provider
```

## Actions

- `token_verdict`: Gets a risk verdict for a token before buying, swapping, or routing funds into it

## Setup

To use the Token Verdict action provider:

```python
from coinbase_agentkit import token_verdict_action_provider

provider = token_verdict_action_provider()

# Or with overrides (e.g. a different service deployment or price guard)
from coinbase_agentkit.action_providers.token_verdict.utils import TokenVerdictOptions

provider_with_options = token_verdict_action_provider(
    TokenVerdictOptions(
        base_url="https://token-verdict-production.up.railway.app",  # default
        max_amount_per_payment="$0.02",  # spend guard, defaults to the known price
    )
)
```

The wallet provider must be an EVM wallet on Base mainnet — payment settles in USDC on Base regardless of which chain's token is analyzed.

## Action Details

### Token Verdict

Gets a risk verdict for a token. The action's arguments mirror the service's real request contract for `POST /v1/verdict`:

| Arg       | Type                                                | Notes                        |
| --------- | --------------------------------------------------- | ---------------------------- |
| `address` | `0x...` string (required)                           | Token contract address.      |
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

The provider adapts the AgentKit wallet provider into an x402 signer (`EvmWalletProvider.to_signer()` → `EthAccountSigner`) and runs the standard x402 v2 client flow — the `x402` SDK's requests session with the exact EVM scheme registered — the same client stack AgentKit's own `x402` provider registers:

1. Unpaid `POST /v1/verdict` → HTTP 402 challenge.
2. The client signs an EIP-3009 `TransferWithAuthorization` for $0.02 USDC on Base with the agent wallet and retries with the `PAYMENT-SIGNATURE` header.
3. The service verifies and settles through its facilitator server-side.

A spend guard caps each call at the known price: a payment policy filters the challenge's payment requirements to USDC-on-Base requirements at or under `max_amount_per_payment` (default `"$0.02"`) before anything is signed, so a repriced or hostile endpoint can never silently charge the agent more.

## Relationship to the Generic x402 Provider

AgentKit already ships a generic [x402 action provider](../x402/README.md) — a general-purpose rail for discovering and calling any x402 endpoint, with raw responses and a confirmation flow. This provider is the complementary piece: a dedicated, typed action for one specific service, with its real request/response contract as a Pydantic schema, the verdict returned in a form the agent can reason over directly, and the price guard pinned to the service's known price. Builders who prefer the generic route can reach this same endpoint through the `x402` provider today; this provider simply offers the other path.

## Network Support

EVM wallets on Base mainnet only (`supports_network` returns true for `chain_id` 8453 / `base-mainnet`).

## Also Available As

- TypeScript: AgentKit action provider ([coinbase/agentkit#1598](https://github.com/coinbase/agentkit/pull/1598)) and the standalone npm package [`token-verdict-agentkit`](https://www.npmjs.com/package/token-verdict-agentkit)
- Service: https://token-verdict-production.up.railway.app
- Source: https://github.com/QuincyGB/token-verdict-tools

## Notes

For more information about the x402 protocol, visit the [x402 documentation](https://docs.cdp.coinbase.com/x402/welcome).
