# X402 Action Provider

This directory contains the **X402ActionProvider** implementation, which provides actions to interact with **x402-protected APIs** that require payment to access.

## Directory Structure

```
x402/
├── x402ActionProvider.ts         # Main provider with x402 payment functionality
├── schemas.ts                    # x402 action schemas
├── index.ts                      # Main exports
├── utils.ts                      # Utility functions
└── README.md                     # This file
```

## Actions

### Primary Actions (Recommended Flow)

1. `make_http_request`: Make initial HTTP request and handle 402 responses
2. `retry_http_request_with_x402`: Retry a request with payment after receiving payment details

### Alternative Action

- `make_http_request_with_x402`: Direct payment-enabled requests (skips confirmation flow)
- `discover_x402_services`: Discover available x402 services (optionally filter by asset and price)

## Overview

The x402 protocol enables APIs to require micropayments for access. When a client makes a request to a protected endpoint, the server responds with a `402 Payment Required` status code along with payment instructions.

### Recommended Two-Step Flow

1. Initial Request:
   - Make request using `make_http_request`
   - If endpoint doesn't require payment, get response immediately
   - If 402 received, get payment options and instructions

2. Payment & Retry (if needed):
   - Review payment requirements
   - Use `retry_http_request_with_x402` with chosen payment option
   - Get response with payment proof

This flow provides better control and visibility into the payment process.

### Direct Payment Flow (Alternative)

For cases where immediate payment without confirmation is acceptable, use `make_http_request_with_x402` to handle everything in one step.

## Usage

### `make_http_request` Action

Makes initial request and handles 402 responses:

```typescript
{
  url: "https://api.example.com/data",
  method: "GET",                    // Optional, defaults to GET
  headers: { "Accept": "..." },     // Optional
  body: { ... }                     // Optional
}
```

### `retry_http_request_with_x402` Action

Retries request with payment after 402:

```typescript
{
  url: "https://api.example.com/data",
  method: "GET",                    // Optional, defaults to GET
  headers: { "Accept": "..." },     // Optional
  body: { ... },                    // Optional
  selectedPaymentOption: {           // Payment details from 402 response
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "1000",
    asset: "0x..."
  }
}
```

### `make_http_request_with_x402` Action

Direct payment-enabled requests (use with caution):

```typescript
{
  url: "https://api.example.com/data",
  method: "GET",                    // Optional, defaults to GET
  headers: { "Accept": "..." },     // Optional
  body: { ... }                     // Optional
}
```

### `discover_x402_services` Action

Fetches available services and optionally filters them by maximum price in USDC whole units. The action defaults to USDC on the current network:

```typescript
{
  maxUsdcPrice: 0.1 // optional (e.g., 0.1 for $0.10 USDC)
}
```

Example filtering for USDC services under $0.10:

```ts
const maxUsdcPrice = 0.1;

const services = await discover_x402_services({ maxUsdcPrice });


```

## Response Format

Successful responses include payment proof when payment was made:

```typescript
{
  success: true,
  data: { ... },            // API response data
  paymentProof: {           // Only present if payment was made
    transaction: "0x...",   // Transaction hash
    network: "base-sepolia",
    payer: "0x..."         // Payer address
  }
}
```

## Network Support

The x402 provider currently supports the following networks:
- `base-mainnet`
- `base-sepolia`
- `solana-mainnet`
- `solana-devnet`

The provider requires EVM-compatible networks where the wallet can sign payment transactions.

## Dependencies

This action provider requires:
- `axios` - For making HTTP requests
- `x402-axios` - For handling x402 payment flows
- `x402` - For payment requirement types and validation

## Notes

For more information on the **x402 protocol**, visit the [x402 documentation](https://x402.gitbook.io/x402/). 