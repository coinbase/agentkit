# Token Safety Action Provider

This directory contains the **TokenSafetyActionProvider**, which lets an agent check whether a token
is safe (a rug check) before buying, accepting or recommending it. It works for tokens on Base,
Ethereum, Arbitrum, Optimism, Polygon and Solana.

Each check is a paid [x402](https://x402.org) request: **$0.01 in USDC on Base**, paid from the
agent's own wallet. Errors and invalid input are not charged, and the provider reads the price
before paying and refuses anything above its spending cap (default 0.05 USDC).

## Directory Structure

```
tokenSafety/
├── tokenSafetyActionProvider.ts      # Main provider with the check_token_safety action
├── tokenSafetyActionProvider.test.ts # Tests
├── constants.ts                      # Endpoint, chains, spending cap default
├── schemas.ts                        # Input schema and config type
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `check_token_safety`: Rug check a token
  - Inputs: `address` (contract or Solana mint), optional `chain`, optional `since`
  - Returns a 0–100 risk score and level (low, medium, high, critical) with plain-language reasons:
    mint, freeze, blacklist, pause or fee powers, upgradeable code, Token-2022 controls
    (permanent delegate, transfer fees, transfer hooks), holder concentration, thin or missing liquidity
  - Returns the facts behind the score, USD price and liquidity, and a `watch.fingerprint`
  - Passing a previous fingerprint as `since` adds `watch.changes`: new or resolved risks, authority
    changes, and liquidity or price moves

## Configuration

```typescript
import { tokenSafetyActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // must be on base-mainnet, with a little USDC
  actionProviders: [tokenSafetyActionProvider({ maxPaymentUsdc: 0.05 })],
});
```

| Option | Environment variable | Default |
|---|---|---|
| `maxPaymentUsdc` | `TOKEN_SAFETY_MAX_PAYMENT_USDC` | `0.05` |
| `endpoint` | | `https://ca-tax-api-mainnet.lxtap.workers.dev/token` |

## Network Support

The paying wallet must be on `base-mainnet`. The token being checked can be on any of the six
supported chains.

## Example

```bash
Prompt: is 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed on Base safe?

-------------------
{
  "address": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  "chain": "base",
  "name": "Degen",
  "symbol": "DEGEN",
  "risk": {
    "score": 15,
    "level": "low",
    "reasons": [
      { "code": "can-pause", "points": 10, "text": "The owner can pause all transfers." },
      { "code": "owner-not-renounced", "points": 5, "text": "Ownership is not renounced." }
    ],
    "summary": "Low risk: the owner can pause all transfers; ownership is not renounced."
  },
  ...
}
-------------------
DEGEN looks low risk (15/100). The owner can still pause transfers and hasn't renounced ownership.
```

The score is rules-based and is not investment advice.
