# 🛡️ Ingravity Security Action Provider for Coinbase AgentKit

Official Community Action Provider for **Coinbase AgentKit** delivering autonomous pre-flight Web3 security, drainer interception, token honeypot scanning, and atomic EIP-5792 Safe-Harbor rescue for AI agents across 5 EVM networks (**Base**, Arbitrum, Optimism, Polygon, and Ethereum).

## Overview

As autonomous AI agents manage increasing treasury balances on Base Mainnet (`eip155:8453`), signing transactions without pre-flight security exposes agents to malicious drainers, infinite token approvals (`0xfff...`), fake proxies, and liquidity honeypot traps.

The **Ingravity Security Action Provider** equips AgentKit agents with autonomous, zero-custody security tools settled via native **HTTP 402 (x402 v2)** micropayments in Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).

---

## Key Capabilities & Actions

| Action Name | Default Price | Description |
| :--- | :--- | :--- |
| `ingravity_fast_ping` | **$0.01 USDC** | Ultra-low-cost binary `SAFE`/`DANGER` address gate for high-frequency bots. |
| `ingravity_tx_firewall` | **$0.10 USDC** | Pre-flight transaction simulator, proxy inspection, and drainer blocking. |
| `ingravity_token_rug_scanner`| **$0.12 / $0.04** | Live RPC token disassembly, honeypot detection & proxy storage check without source code. |
| `ingravity_defi_math_guard` | **$0.10 / $0.04** | Exact BigInt AMM slippage & MEV anti-sandwich bounds on Uniswap v3 & Aerodrome. |
| `ingravity_audit_solidity` | **$0.85 / $0.35** | 24-vector static security audit with Anti-Bypass critical remediation seal. |
| `ingravity_protocol_dossier` | **$12.00 / $3.50** | Multi-contract cross-reentrancy and oracle invariant graph. |
| `ingravity_deep_exploit_bounty` | **$45.00 / $9.50** | Institutional flash-loan simulation + EIP-5792 atomic Safe-Harbor rescue split. |

---

## Quickstart

```typescript
import { AgentKit, CdpEvmWalletProvider } from "@coinbase/agentkit";
import { ingravityActionProvider } from "./action-providers/ingravity";

const walletProvider = new CdpEvmWalletProvider({
  networkId: "base-mainnet",
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    ingravityActionProvider({
      maxSpendUsdc: 0.10, // Spending cap for auto-negotiated security checks
      enableReceiptCache: true, // Reuses session tokens to prevent double payment
    }),
  ],
});
```

---

## Settlement & Security Model

1. **Zero-Custody (x402 v2):**  
   Never requests token allowances (`approve()`). Micropayments execute strictly per-call directly on Base Mainnet to the verified recipient wallet.
2. **Base Builder Attribution (ERC-8021):**  
   All generated rescue transactions automatically carry the builder attribution code `bc_i26d7owr` appended to execution calldata.
3. **Budget Guardrail (`maxSpendUsdc`):**  
   Agents enforce client-side budget caps. If an action exceeds `maxSpendUsdc`, the provider auto-negotiates to the `ESSENTIAL` tier or aborts execution cleanly.
4. **Receipt Caching:**  
   Subsequent identical queries in the same agent session reuse cryptographic `X-Ingravity-Receipt-Token` headers, preventing duplicate charges.
