# Tolca Action Provider

This directory contains the **TolcaActionProvider**, which lets an agent check who it is about to pay before an x402 payment.

## Directory Structure

```
tolca/
├── tolcaActionProvider.ts       # Provider with the two actions
├── tolcaActionProvider.test.ts  # Tests
├── schemas.ts                   # Action schemas and configuration type
├── index.ts                     # Main exports
└── README.md                    # This file
```

## Actions

### `check_x402_seller`

Checks an x402 seller before the agent pays it ($0.01 USDC per check). Give the seller's `url` (Tolca reads its 402 payment request without paying it) or the `paymentRequired` object the agent already received, and optionally the `sellerName`.

Tolca checks:

- the `payTo` wallet against OFAC SDN crypto addresses
- that the asset is the official USDC contract on its network, and that the network is a mainnet
- that price and `payTo` match the seller's Coinbase x402 Bazaar listing
- optionally, the seller's company name against US, UK and EU sanctions lists

The answer's `action` is `allow`, `review` (ask a human before paying) or `block`, with the reasons and an Ed25519-signed receipt.

### `screen_sanctions`

Screens a company or person name against US (Consolidated Screening List, including OFAC SDN), UK and EU sanctions lists ($0.005 USDC per check). Returns `allow`, `review` or `block`, the matching entries, the date of each list and a signed receipt.

## Payment

Each call is paid per use over x402 from the agent's own wallet, in USDC on Base mainnet or Solana mainnet. No API key or account is needed.

Before paying, the provider reads Tolca's 402 payment request and refuses to pay unless every option goes to Tolca's own wallet, in official USDC, at or below `maxPriceUsdc` (default 0.02 USDC).

## Configuration

```typescript
import { tolcaActionProvider } from "@coinbase/agentkit";

const provider = tolcaActionProvider({
  maxPriceUsdc: 0.02, // optional, highest price paid for one call
});
```

## Network Support

- Base mainnet (`base-mainnet`)
- Solana mainnet (`solana-mainnet`)

## Notes

- Signed receipts can be verified at https://tolca.tonbot.ca/receipts/verify with the public key at https://tolca.tonbot.ca/.well-known/tolca-receipt-key.json.
- API reference: https://tolca.tonbot.ca/openapi.json
