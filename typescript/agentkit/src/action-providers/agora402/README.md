# Agora402 Action Provider

This directory contains the **Agora402ActionProvider**, which adds USDC escrow protection, on-chain trust scores, and dispute resolution to any AgentKit agent.

Agora402 complements the x402 action provider: while x402 handles direct payments, Agora402 adds buyer protection by routing funds through an on-chain escrow contract. Funds are only released when delivery is verified.

## Directory Structure

```
agora402/
├── agora402ActionProvider.ts       # Main provider with 6 escrow actions
├── agora402ActionProvider.test.ts  # Unit tests
├── schemas.ts                      # Zod schemas for action inputs
├── constants.ts                    # Contract addresses, ABIs, state names
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Configuration

```typescript
import { agora402ActionProvider } from "@coinbase/agentkit";

// Default: uses deployed contracts on Base mainnet / Base Sepolia
const provider = agora402ActionProvider();

// Or with custom contract addresses:
const customProvider = agora402ActionProvider({
  escrowAddress: "0x...",
  reputationAddress: "0x...",
  usdcAddress: "0x...",
});
```

## Actions

### Core Escrow Actions

| Action | Description |
|--------|-------------|
| `agora402_create_escrow` | Lock USDC in escrow for a transaction ($0.10–$100) |
| `agora402_release_escrow` | Confirm delivery, release funds to seller (2% fee) |
| `agora402_dispute_escrow` | Flag bad delivery, lock funds for arbiter review |
| `agora402_check_escrow` | Check escrow state (Funded/Released/Disputed/Expired/...) |
| `agora402_check_trust_score` | On-chain trust score lookup (0–100) before transacting |
| `agora402_protected_api_call` | **Flagship** — escrow + API call + verify + auto-release/dispute |

### Escrow State Machine

```
FUNDED → RELEASED        (buyer confirms delivery)
       → DISPUTED → RESOLVED  (arbiter rules)
       → EXPIRED → REFUNDED   (auto-refund to buyer)
```

### `agora402_create_escrow`

Creates a USDC escrow. Automatically approves USDC spending if needed.

```typescript
{
  seller: "0x1234...abcd",       // Seller's Ethereum address
  amount_usdc: 0.50,             // $0.50 USDC (whole units, not wei)
  timelock_minutes: 30,          // Escrow expires after 30 minutes
  service_url: "https://api.example.com/weather"
}
```

### `agora402_release_escrow`

Releases funds to the seller after delivery is confirmed. A 2% protocol fee is deducted.

```typescript
{
  escrow_id: "0"                 // Escrow ID from create_escrow
}
```

### `agora402_dispute_escrow`

Flags a problem and locks funds for arbiter review.

```typescript
{
  escrow_id: "0",
  reason: "API returned error 500 instead of valid data"
}
```

### `agora402_check_trust_score`

Looks up on-chain trust score before transacting with an unknown agent.

```typescript
{
  address: "0x1234...abcd"       // Agent address to check
}
// Returns: { score: 85, recommendation: "high_trust", totalEscrows: 42, ... }
```

### `agora402_protected_api_call` (Flagship)

One-shot escrow-protected API call with automatic verification:

```typescript
{
  url: "https://api.example.com/weather",
  method: "GET",
  seller_address: "0x1234...abcd",
  amount_usdc: 0.10,
  timelock_minutes: 30,
  verification_schema: '{"type":"object","required":["temperature","location"]}'
}
// If response has temperature + location → auto-release payment
// If response fails schema → auto-dispute, funds locked for review
```

## Network Support

| Network | Chain ID | Status |
|---------|----------|--------|
| Base mainnet | 8453 | Deployed |
| Base Sepolia | 84532 | Deployed |

## Protocol Details

- **Token**: USDC only
- **Fee**: 2% on release/resolve, 0% on refund
- **Escrow range**: $0.10 – $100 per escrow
- **Timelock**: 5 minutes – 30 days
- **Trust scores**: 0–100, computed on-chain from escrow history

## Dependencies

No additional dependencies — uses only `viem` (already included in AgentKit).

## Additional Resources

- [Agora402 GitHub](https://github.com/michu5696/agentBank)
- [Agora402 MCP Server](https://www.npmjs.com/package/agora402) — for non-AgentKit agents
- [x402 Protocol](https://www.x402.org/)
