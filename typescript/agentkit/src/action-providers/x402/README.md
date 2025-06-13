# X402 Action Provider

This directory contains the **X402ActionProvider** implementation, which provides actions to interact with **x402-protected APIs** that require payment to access.

## Directory Structure

```
x402/
├── x402ActionProvider.ts         # Main provider with x402 payment functionality
├── schemas.ts                    # x402 action schemas
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

- `paid_request`: Make HTTP requests to x402-protected API endpoints with automatic payment handling
- `fetch_payment_info`: Get payment information from x402-protected endpoints without making payments

## Overview

The x402 protocol enables APIs to require micropayments for access. When a client makes a request to a protected endpoint, the server responds with a `402 Payment Required` status code along with payment instructions. This action provider automatically handles the entire payment flow:

1. Makes the initial request to the protected API
2. If a 402 response is received, automatically processes the payment using the wallet
3. Retries the request with payment proof
4. Returns the API response data

## Usage

### `paid_request` Action

The `paid_request` action accepts the following parameters:

- **url**: The full URL of the x402-protected API endpoint
- **method**: HTTP method (GET, POST, PUT, DELETE, PATCH) - defaults to GET
- **headers**: Optional additional headers to include in the request  
- **body**: Optional request body for POST/PUT/PATCH requests

### `fetch_payment_info` Action

The `fetch_payment_info` action accepts the following parameters:

- **url**: The full URL of the x402-protected API endpoint
- **method**: HTTP method (GET, POST, PUT, DELETE, PATCH) - defaults to GET
- **headers**: Optional additional headers to include in the request

This action is useful for:
- Checking payment requirements before committing to a paid request
- Understanding the cost structure of an API
- Getting details about accepted payment tokens and amounts
- Debugging x402 payment configurations

## Network Support

The x402 provider currently supports the following networks:
- `base-mainnet`
- `base-sepolia`

The provider requires EVM-compatible networks where the wallet can sign payment transactions.

## Dependencies

This action provider requires:
- `axios` - For making HTTP requests
- `x402-axios` - For handling x402 payment flows

## Notes

For more information on the **x402 protocol**, visit the [x402 documentation](https://x402.gitbook.io/x402/). 