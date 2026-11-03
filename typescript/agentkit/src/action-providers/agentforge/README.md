# AgentForge Action Provider

DeFi safety checks for agents from [AgentForge](https://agentforge-taupe.vercel.app), paid per call in USDC on Base over x402 from the agent's own wallet. No API key.

## Actions

| Action | What it does | Price |
| --- | --- | --- |
| `simulate_transaction` | Simulates 1-5 EVM transactions before signing: reverts with reasons, net asset changes, approvals granted, counterparty sanctions/scam screening, proceed/caution/avoid verdict | $0.005 |
| `check_addresses` | Screens 1-100 EVM or Solana addresses against OFAC sanctions, scam/phishing wallets, and fresh address-poisoning wallets | $0.003 + $0.001/extra |
| `check_token_before_trade` | Rug-check metrics + AI risk assessment + gas for an ERC-20, with a verdict | $0.025 |
| `get_new_token_launches` | Newly launched tokens on Base, Ethereum, or Arbitrum, already risk-scored; poll with `since` | $0.005 |
| `score_tokens` | Risk scores for 2-25 tokens in one call | $0.004/token |
| `check_lending_health` | Aave v3 liquidation risk on five chains | $0.003 |

## Usage

```typescript
import { AgentKit, agentforgeActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider, // must be on base-mainnet and hold USDC
  actionProviders: [agentforgeActionProvider({ maxPaymentUsdc: 0.05 })],
});
```

## Configuration

| Option | Env var | Default | Description |
| --- | --- | --- | --- |
| `maxPaymentUsdc` | `AGENTFORGE_MAX_PAYMENT_USDC` | `0.05` | Refuse any single payment above this amount |
| `baseUrl` | — | `https://agentforge-taupe.vercel.app` | API origin |

## Network support

Payments settle on Base mainnet, so the provider is enabled when the wallet is on `base-mainnet`. Simulation, screening, and token checks can target Ethereum, Base, Arbitrum, Optimism, and Polygon via each action's `chain` argument.
