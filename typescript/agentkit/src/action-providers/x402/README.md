# X402 Action Provider

This directory contains the **X402ActionProvider** implementation, which provides actions to interact with **x402-protected APIs** that require payment to access.

## Directory Structure

```
x402/
├── x402ActionProvider.ts         # Main provider with x402 payment functionality
├── schemas.ts                    # x402 action schemas
├── constants.ts                  # Network mappings and type definitions
├── index.ts                      # Main exports
├── utils.ts                      # Utility functions
└── README.md                     # This file
```

## Actions

### Primary Actions (Recommended Flow)

1. `make_http_request`: Make initial HTTP request and handle 402 responses
2. `retry_http_request_with_x402`: Retry a request with payment after receiving payment details

### Alternative Actions

- `make_http_request_with_x402`: Direct payment-enabled requests (skips confirmation flow)
- `discover_x402_services`: Discover available x402 services (optionally filter by price)

## Overview

The x402 protocol enables APIs to require micropayments for access. When a client makes a request to a protected endpoint, the server responds with a `402 Payment Required` status code along with payment instructions.

This provider supports **both v1 and v2 x402 endpoints** automatically.

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

Retries request with payment after 402. Supports both v1 and v2 payment option formats:

```typescript
// v1 format (legacy endpoints)
{
  url: "https://api.example.com/data",
  method: "GET",
  selectedPaymentOption: {
    scheme: "exact",
    network: "base-sepolia",          // v1 network identifier
    maxAmountRequired: "1000",
    asset: "0x..."
  }
}

// v2 format (CAIP-2 network identifiers)
{
  url: "https://api.example.com/data",
  method: "GET",
  selectedPaymentOption: {
    scheme: "exact",
    network: "eip155:84532",          // v2 CAIP-2 identifier
    amount: "1000",
    asset: "0x...",
    payTo: "0x..."
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

Fetches all available services from the x402 Bazaar with full pagination support. Returns simplified output with url, price, and description for each service.

```typescript
{
  facilitator: "cdp",             // Optional: 'cdp', 'payai', or custom URL
  maxUsdcPrice: 0.1,              // Optional, filter by max price in USDC
  keyword: "weather",             // Optional, filter by description/URL keyword
  x402Versions: [1, 2]            // Optional, filter by protocol version
}
```

Example response:

```json
{
  "success": true,
  "walletNetworks": ["base-sepolia", "eip155:84532"],
  "total": 150,
  "returned": 25,
  "services": [
    {
      "url": "https://api.example.com/weather",
      "price": "0.001 USDC on base-sepolia",
      "description": "Get current weather data"
    }
  ]
}
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

The x402 provider supports the following networks:

| Internal Network ID | v1 Identifier | v2 CAIP-2 Identifier |
|---------------------|---------------|----------------------|
| `base-mainnet` | `base` | `eip155:8453` |
| `base-sepolia` | `base-sepolia` | `eip155:84532` |
| `solana-mainnet` | `solana` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `solana-devnet` | `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

The provider supports both EVM and SVM (Solana) wallets for signing payment transactions.

## v1/v2 Compatibility

This provider automatically handles both v1 and v2 x402 endpoints:

- **Discovery**: Filters resources matching either v1 or v2 network identifiers
- **Payment**: The `@x402/fetch` library handles protocol version detection automatically
- **Headers**: Supports both `X-PAYMENT-RESPONSE` (v1) and `PAYMENT-RESPONSE` (v2) headers

## Dependencies

This action provider requires:
- `@x402/fetch` - For handling x402 payment flows
- `@x402/evm` - For EVM payment scheme support
- `@x402/svm` - For Solana payment scheme support

## Notes

For more information on the **x402 protocol**, visit the [x402 documentation](https://docs.cdp.coinbase.com/x402/overview).
