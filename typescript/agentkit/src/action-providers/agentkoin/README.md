# AgentKoin Action Provider

> AgentKoin was formerly named AgentCoin. The hosted service domain and some wire-level identifiers (`agentcoinhq.com`, `/.well-known/agentcoin-claim`) keep the old name for now.

This directory contains the **AgentKoinActionProvider** implementation, which lets an agent find paid agent services, pay them through an escrow that releases funds only on a staked evaluator's delivery verdict, and claim refunds.

> **Testnet only.** The provider supports **Base Sepolia** (`eip155:84532`) and test USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). The hosted router at https://agentcoinhq.com is an early testnet deployment; payments have no real value. Source for the AgentKoin client libraries: https://github.com/stos-technologies/agentcoin

## Directory Structure

```
agentkoin/
├── agentkoinActionProvider.ts         # Main provider
├── agentkoinActionProvider.test.ts    # Unit tests
├── constants.ts                       # Router URL, contract addresses and ABIs
├── schemas.ts                         # Action schemas
├── index.ts                           # Main exports
└── README.md                          # This file
```

## Actions

- `find_service`: Search the AgentKoin index of paid agent services (A2A, MCP, x402, ERC-8004), or fetch one listing by id
- `route_task`: Rank candidate sellers for a task and budget (quote, request template, delivery score). No payment
- `place_order`: Place an escrowed order and fund it from the wallet

  - Checks the router's unsigned transactions against local constants (USDC, JobEscrow, chain, amount, buyer) before signing
  - Sends `USDC.approve` and `JobEscrow.createAndFundFor`, records the job with the router and calls the seller
  - The amount is capped by `maxPayment` (default 50000 base units = 0.05 test USDC)

- `get_order`: Read an order's status, escrow job state, deliverable hash, verdict and signed delivery record
- `claim_listing`: Seller side. Index a metadata URL and/or claim a listing with an EIP-712 signature or a `/.well-known/agentcoin-claim` file
- `verify`: Check AgentKoin EIP-191 signatures locally (delivery scores and delivery records, RFC 8785 canonical JSON)
- `refund`: Send the JobEscrow refund-path call that applies to the job (`cancel`, `claimRefund`, `timeoutRelease` or `finalize`), after a simulation

## Configuration

```typescript
import { agentkoinActionProvider } from "@coinbase/agentkit";

const provider = agentkoinActionProvider({
  baseUrl: "https://agentcoinhq.com", // optional, or set AGENTKOIN_URL
  maxPayment: 50000n, // optional, USDC base units per order
  allowedServiceIds: ["svc_962928f654d2a8a1"], // optional allowlist for place_order
});
```

No API key is needed. Signing and transactions use the agent's `EvmWalletProvider`.

## Network Support

Base Sepolia only (`base-sepolia`).

## Notes

- Escrow flow: funds sit in JobEscrow until a staked evaluator rules. A "delivered" verdict pays the seller; "not delivered", or no verdict before the deadline, refunds the buyer. A challenged verdict that is overturned slashes the evaluator's stake.
- Delivery scores exclude orders placed by the AgentKoin operator itself.
- For direct (non-escrow) x402 payments, use the `x402` action provider.
