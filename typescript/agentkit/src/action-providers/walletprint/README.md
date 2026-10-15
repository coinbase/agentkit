# WalletPrint Action Provider

Behavioral transaction risk scoring for AI agent wallets.

## Overview

The WalletPrint action provider scores proposed transactions against a wallet's own behavioral history **before they are signed**. It calls the [WalletPrint API](https://walletprint.up.railway.app) and returns a risk score (0–100), a band (`low` / `medium` / `high`), and plain-English reason codes.

This action is **advisory only** — it never blocks a transaction. The agent decides what to do with the result.

## Supported Networks

- Ethereum mainnet (chain ID 1)
- Base (chain ID 8453)

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { walletprintActionProvider } from "@coinbase/agentkit/action-providers/walletprint";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    walletprintActionProvider({ apiKey: "your-api-key" }),
  ],
});
```

Use `walletprint-dev-key` as the API key for sandbox testing.

## Actions

### `score_transaction`

Scores a proposed transaction before signing.

**Inputs:**

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | string | ✓ | Recipient address (0x-prefixed) |
| `value_usd` | number | ✓ | USD value of the transaction |
| `asset` | string | ✓ | Asset being transferred (e.g. `"USDC"`, `"ETH"`) |
| `contract_category` | string | | Category of the contract being called (e.g. `"erc20"`, `"defi"`, `"bridge"`) |

**Output:**

```json
{
  "success": true,
  "risk_score": 72,
  "band": "high",
  "reasons": ["New recipient address", "Amount 4x above 30-day average"],
  "recommendation": "escalate",
  "summary": "Risk score: 72/100 (high). New recipient address; Amount 4x above 30-day average."
}
```

## Links

- [GitHub](https://github.com/Loai17/walletprint-sdk)
- [npm](https://www.npmjs.com/package/@walletprint/sdk)
- [API](https://walletprint.up.railway.app)
