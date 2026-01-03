# X402 Action Provider

This directory contains the **X402ActionProvider** implementation, which provides actions to interact with **x402-protected APIs** that require payment to access.

## Directory Structure

```
x402/
├── x402_action_provider.py      # Main provider with x402 payment functionality
├── schemas.py                   # x402 action schemas
├── __init__.py                 # Main exports
└── README.md                   # This file
```

## Actions

### Primary Actions (Recommended Flow)

1. `make_http_request`: Make initial HTTP request and handle 402 responses
2. `retry_http_request_with_x402`: Retry a request with payment after receiving payment details

### Alternative Action

- `make_http_request_with_x402`: Direct payment-enabled requests (skips confirmation flow)

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

```python
{
    "url": "https://api.example.com/data",
    "method": "GET",                    # Optional, defaults to GET
    "headers": { "Accept": "..." },     # Optional
    "body": { ... }                     # Optional
}
```

Response format for 402 status:
```python
{
    "status": "error_402_payment_required",
    "acceptablePaymentOptions": [
        {
            "scheme": "exact",
            "network": "base-sepolia",
            "maxAmountRequired": "1000",
            "resource": "https://api.example.com/data",
            "description": "Access to data",
            "mimeType": "application/json",
            "payTo": "0x...",
            "maxTimeoutSeconds": 300,
            "asset": "0x..."
        }
    ],
    "nextSteps": [
        "Inform the user that the server replied with a 402 Payment Required response.",
        "The payment options are: [asset] [amount] [network]",
        "Ask the user if they want to retry the request with payment.",
        "Use retry_http_request_with_x402 to retry the request with payment."
    ]
}
```

### `retry_http_request_with_x402` Action

Retries request with payment after 402:

```python
{
    "url": "https://api.example.com/data",
    "method": "GET",                    # Optional, defaults to GET
    "headers": { "Accept": "..." },     # Optional
    "body": { ... },                    # Optional
    # Payment details (all fields required)
    "scheme": "exact",
    "network": "base-sepolia",
    "max_amount_required": "1000",
    "resource": "https://api.example.com/data",
    "pay_to": "0x...",
    "max_timeout_seconds": 300,
    "asset": "0x...",
    # Optional payment details
    "description": "",                  # Optional
    "mime_type": "",                    # Optional
    "output_schema": null,              # Optional
    "extra": null                       # Optional
}
```

### `make_http_request_with_x402` Action

Direct payment-enabled requests (use with caution):

```python
{
    "url": "https://api.example.com/data",
    "method": "GET",                    # Optional, defaults to GET
    "headers": { "Accept": "..." },     # Optional
    "body": { ... }                     # Optional
}
```

## Response Format

Successful responses include payment proof when payment was made:

```python
{
    "status": "success",
    "data": { ... },                    # API response data
    "message": "Request completed successfully with payment",
    "details": {
        "url": "https://api.example.com/data",
        "method": "GET",
        "paymentUsed": {
            "network": "base-sepolia",
            "asset": "0x...",
            "amount": "1000"
        },
        "paymentProof": {               # Only present if payment was made
            "transaction": "0x...",      # Transaction hash
            "network": "base-sepolia",
            "payer": "0x..."            # Payer address
        }
    }
}
```

Error responses include helpful details and suggestions:
```python
{
    "error": true,
    "message": "Error description",
    "details": "Detailed error information",
    "suggestion": "Helpful suggestion for resolving the error"
}
```

## Network Support

The x402 provider currently supports the following networks:
- `base-mainnet`
- `base-sepolia`

The provider requires EVM-compatible networks where the wallet can sign payment transactions.

## Dependencies

This action provider requires:
- `requests` - For making HTTP requests
- `x402` - For payment requirement types and validation
- An EVM-compatible wallet provider for signing transactions

## Notes

For more information on the **x402 protocol**, visit the [x402 documentation](https://x402.gitbook.io/x402/).
