# GROUNDTRUTH Action Provider

This directory contains the **GroundtruthActionProvider**, which looks up [GROUNDTRUTH](https://groundtruths.xyz): the recorded outcomes of memecoin launches on **Solana (pump.fun)** and **Robinhood Chain**, and the track record of the wallets that launch them.

It answers the questions an agent should ask before it buys a newly launched token. The answers are records, not safety ratings.

## Directory Structure

```
groundtruth/
├── groundtruthActionProvider.ts         # Main provider
├── groundtruthActionProvider.test.ts    # Tests
├── schemas.ts                           # Action schemas
├── index.ts                             # Main exports
└── README.md                            # This file
```

## Actions

- `get_creator_record`: the launch record of a creator (deployer) wallet: launches, rugged, died, survived, graduated (`/v1/flag`)
- `get_coin_record`: the record of one coin by contract address: outcome and creator (`/v1/record`)
- `get_known_bad_flag`: whether a creator rugs more often than the chain baseline by more than chance, with its statistical basis (`/api/flag`)

Every action takes `address` (Solana base58 or Robinhood Chain `0x…`) and an optional `chain` (`solana` or `rh`). When `chain` is empty, it is inferred from the address format.

## Configuration

```typescript
import { groundtruthActionProvider } from "@coinbase/agentkit";

const provider = groundtruthActionProvider({ apiKey: process.env.GROUNDTRUTH_API_KEY });
```

| option | env | |
|---|---|---|
| `apiKey` | `GROUNDTRUTH_API_KEY` | optional, sent as `x-api-key` |
| `apiUrl` | — | default `https://api.groundtruths.xyz` |

Without a key, a small free allowance per IP applies. After that, the API answers `402` with an x402 challenge ($0.01 USDC per call on Solana or Base), and the action says so. An agent can pay per call with AgentKit's `x402` action provider.

## Network Support

GROUNDTRUTH is an off-chain HTTP API, so it works with every network.

## Notes

- `known_bad: null` means the creator is not in the published set. Absence is not innocence.
- A coin launched minutes ago has no outcome yet.
- MCP server: `https://api.groundtruths.xyz/mcp` (official MCP Registry `xyz.groundtruths/groundtruth`).
