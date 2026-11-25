# Ingravity Security Action Provider

This directory contains the **Ingravity Security** action provider for Coinbase AgentKit, enabling autonomous AI agents to run deterministic 5-EVM pre-flight transaction firewall checks, live RPC ERC-20 honeypot/rugpull disassembly, exact BigInt AMM MEV slippage math, and Solidity security audits settled gaslessly via native **x402 v2** Base USDC micropayments (`@x402/fetch` + `@x402/evm`).

## Supported Networks

- **Settlement Network:** Base Mainnet (`eip155:8453`, Native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Inspected EVM Chains:** Base (`8453`), Arbitrum (`42161`), Optimism (`10`), Polygon (`137`), Ethereum (`1`)

## Actions

| Action | Route | Price (Base USDC) | Description |
| :-- | :-- | :-- | :-- |
| `ingravity_fast_ping` | `GET /api/v1/fast-ping` | `$0.01` | Binary `SAFE`/`DANGER` address gate for high-frequency bots. |
| `ingravity_tx_firewall` | `POST /api/v1/tx-firewall` | `$0.10` | Pre-sign calldata simulation, EIP-1967/1167 proxy inspection & drainer guard. |
| `ingravity_token_rug_scanner` | `POST /api/v1/token-rug-scanner` | `$0.12` / `$0.04` | Live RPC ERC-20 bytecode disassembly & honeypot scanner (no `.sol` required). |
| `ingravity_defi_math_guard` | `POST /api/v1/defi-math-guard` | `$0.10` / `$0.04` | Exact 18-decimal BigInt AMM slippage, MEV sandwich & liquidation limits. |
| `ingravity_audit_solidity` | `POST /api/v1/audit-solidity` | `$0.85` / `$0.35` | Deterministic 24-vector Solidity static audit with 4-gate anti-noise filter. |
| `ingravity_protocol_dossier` | `POST /api/v1/protocol-dossier` | `$12.00` / `$3.50` | Multi-contract (1-20 files) cross-reentrancy & ERC-4626/oracle invariants. |
| `ingravity_deep_exploit_bounty` | `POST /api/v1/deep-exploit-bounty` | `$45.00` / `$9.50` | Institutional flash-loan simulation & unsigned Safe-Harbor rescue planner. |

## Usage

```typescript
import {
  AgentKit,
  CdpEvmWalletProvider,
  ingravityActionProvider,
} from "@coinbase/agentkit";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  networkId: "base-mainnet",
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    ingravityActionProvider({
      maxSpendUsdc: 0.1,
      enableReceiptCache: true,
    }),
  ],
});
```

## Security & Budget Guardrails

- **Gasless Zero-Custody x402 v2:** Uses `@x402/fetch` and `@x402/evm` EIP-3009 `PAYMENT-SIGNATURE` via `walletProvider.toSigner()`. Never requests ERC-20 `approve()`.
- **Pre-Sign Spending Cap (`maxSpendUsdc`):** Validates atomic `accepts[0].amount` from the `PAYMENT-REQUIRED` / 402 response before signing any authorization.
- **Session Receipt Reuse:** Caches `X-Ingravity-Receipt-Token` headers so identical checks in the same session are not billed twice.
- **ERC-8021 Attribution:** Exports `encodeErc8021Calldata` carrying Base Builder Code `bc_i26d7owr`.
