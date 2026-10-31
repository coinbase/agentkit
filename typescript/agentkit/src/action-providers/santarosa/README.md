# Santa Rosa Action Provider

This directory contains the **SantaRosaActionProvider** implementation for Coinbase AgentKit on Base L2 (`base-mainnet` and `base-sepolia`).

## Overview

The `SantaRosaActionProvider` equips autonomous AI agents with high-velocity, ultra-low fee DeFi execution and risk mitigation capabilities:

1. **Ultra-Low Fee Swaps (0.03%)**: Executes token swaps on Base L2 through the Santa Rosa Smart Router at 3 bps (saving 88% compared to standard 25 bps DEX routers like Uniswap).
2. **0% Flash Loan Multipliers**: 1-click leverage using Morpho Blue 0.00% fee flash loans at a 0.10% total fee (0.08% protocol, 0.02% developer revenue share).
3. **Anti-Liquidation Debt Rescue**: Automatically deleverages at-risk CDP debt positions on Morpho Blue and Aave v3 before MEV liquidators strike, cutting liquidation penalties from 5% down to 0.25% (20x savings).
4. **Instant Builder Revenue Share**: Programmatically distributes 0.01% - 0.05% of executed volume directly to the agent operator or partner wallet on-chain in the same transaction.

## Directory Structure

```
santarosa/
├── constants.ts                    # Protocol constants (Router, Base ChainId, ABIs)
├── schemas.ts                      # Zod validation schemas for all actions
├── santaRosaActionProvider.ts      # Main provider class and decorated action methods
├── santaRosaActionProvider.test.ts # Jest unit test suite
├── index.ts                        # Barrel exports
└── README.md                       # Documentation
```

## Available Actions

- **`swap`**: Swaps tokens on Base L2 at 0.03% fee (88% savings vs Uniswap 0.25%).
- **`quote_leverage_multiply`**: Quotes 1-click leverage multiply plan using Morpho flash loans.
- **`get_user_debt_positions`**: Scans active debt positions on Base L2 across Morpho Blue.
- **`simulate_rescue_savings`**: Simulates anti-liquidation rescue savings vs 5% MEV penalty.
- **`build_rescue_transaction`**: Generates executable calldata targeting Santa Rosa Router (`0xcd4f88bca4e2653fd24f61b4ef3aaccd76310a57`).

## Quickstart

```typescript
import { AgentKit, EvmWalletProvider } from "@coinbase/agentkit";
import { santaRosaActionProvider } from "@coinbase/agentkit";

const santaRosa = santaRosaActionProvider("0xYourPartnerWalletAddress");

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [santaRosa],
});
```

## Network Support

- **Base Mainnet** (`base-mainnet`, Chain ID `8453`)
- **Base Sepolia** (`base-sepolia`, Chain ID `84532`)
