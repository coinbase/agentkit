# Tereno Action Provider

This directory contains the **TerenoActionProvider** implementation, which provides pre-action onchain verification, token launch exit simulation, holder concentration analysis, contract bytecode auditing, and prediction market evidence on Base over **x402** micropayments.

## Directory Structure

```
tereno/
├── terenoActionProvider.ts       # Main provider with Tereno capabilities
├── terenoActionProvider.test.ts  # Unit tests
├── schemas.ts                    # Zod input schemas
├── index.ts                      # Exports
└── README.md                     # This file
```

## Configuration

The `TerenoActionProvider` accepts an optional configuration object when initialized:

```typescript
import { terenoActionProvider } from "@coinbase/agentkit";

const provider = terenoActionProvider({
  // Base URL of the Tereno API (defaults to "https://www.tereno.xyz")
  baseUrl: "https://www.tereno.xyz",

  // Maximum price in USDC per capability invocation (defaults to 0.10 USDC)
  maxPriceUsd: 0.1,

  // Optional custom Base RPC URL for local bytecode fingerprinting
  rpcUrl: "https://mainnet.base.org",

  // Optional Base Builder Code (ERC-8021 attribution)
  builderCode: "bc_...",
});
```

## Actions

### Paid Verification Actions (x402 v2 on Base)

- `check_token_launch` (`token.launch.guard`): Simulates buy/sell exit via `eth_call`, checks DEX LP reserve depth, liquidity lock/burn status, and owner privileges on Base (`$0.02` cache hit / `$0.04–$0.07` fresh).
- `check_token_holders` (`token.holders.guard`): Inspects top-10 holder concentration, ETH funding-origin graph, and deployer-funded Sybil clusters on Base (`$0.01` cache hit / `$0.02–$0.04` fresh).
- `check_contract` (`contract.guard`): Audits executable runtime bytecode, EIP-1967 proxy implementation slots, pause status, and static selector flags on Base (`$0.01` cache hit / `$0.02–$0.03` fresh).
- `get_token_metadata` (`token.metadata`): Retrieves verified ERC-20 `name`, `symbol`, `decimals`, and block-fresh `totalSupply` on Base (`$0.01` cache hit / `$0.02–$0.03` fresh).
- `get_chain_snapshot` (`chain.snapshot`): Returns latest Base block number, timestamp, base fee, and suggested gas parameters (`$0.01` cache hit / `$0.02` fresh).
- `get_prediction_evidence` (`prediction.evidence`): Audits prediction market resolution rules, oracle dispute risk, and sourced evidence (`$0.01` cache hit / `$0.02–$0.05` fresh).

### Free Discovery & Cooperative Seeding Actions

- `quote_contract_guard`: Quotes the current USDC price and cache status for a contract check before spending USDC.
- `list_capabilities`: Lists active Tereno capabilities, schemas, pricing tiers, and validity windows (TTLs).
- `list_bounties`: Lists open unseeded demand bounties on Base (`misses >= 2`).
- `publish_contract_fingerprint`: Publishes a verified contract bytecode fingerprint via EIP-712 signature to claim the seeder slot and earn 20% lifetime reuse dividends in non-transferable discount credits.

## Network Support

The Tereno provider supports **Base Mainnet** (`8453` / `eip155:8453`) and **Base Sepolia** (`84532` / `eip155:84532`) with any `EvmWalletProvider`.
