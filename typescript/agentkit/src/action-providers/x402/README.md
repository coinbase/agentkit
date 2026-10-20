# X402 Action Provider

This directory contains the **X402ActionProvider** implementation, which provides actions to interact with **x402-protected APIs** that require payment to access.

## Directory Structure

```
x402/
├── x402ActionProvider.ts         # Main provider with x402 payment functionality
├── schemas.ts                    # x402 action schemas and configuration types
├── constants.ts                  # Network mappings and type definitions
├── index.ts                      # Main exports
├── utils.ts                      # Utility functions
└── README.md                     # This file
```

## Configuration

The X402ActionProvider accepts an optional configuration object when initialized:

```typescript
import { x402ActionProvider, X402Config } from "@coinbase/cdp-agentkit";

const config: X402Config = {
  // Service URLs the agent can call (whitelist)
  registeredServices: ["https://api.example.com", "https://weather.x402.io"],

  // Allow agent to register new services at runtime
  // Default: false (or X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION="true" env var)
  allowDynamicServiceRegistration: true,

  // Custom facilitators for service discovery
  registeredFacilitators: {
    myFacilitator: "https://my-facilitator.com",
  },

  // Maximum payment per request in USDC
  // Default: 1.0 (or X402_MAX_PAYMENT_USDC env var)
  maxPaymentUsdc: 0.5,
};

const provider = x402ActionProvider(config);
```

- **Service Whitelisting**: Only registered service URLs can be called
- **USDC-Only Payments**: All payments are restricted to USDC assets only
- **Payment Limits**: Enforces maximum payment amount per request (default: 1.0 USDC)
- **Dynamic Registration Control**: Optional runtime service registration via agent

## Actions

### Service Management Actions

1. `list_registered_services`: List all approved service URLs
2. `list_registered_facilitators`: List all available facilitators for discovery
3. `register_x402_service`: Register new service URL (requires `allowDynamicServiceRegistration: true`)

### Primary Actions (Recommended Flow)

1. `make_http_request`: Make initial HTTP request and handle 402 responses
2. `retry_http_request_with_x402`: Retry a request with payment after receiving payment details

### Alternative Actions

- `make_http_request_with_x402`: Direct payment-enabled requests (skips confirmation flow)
- `discover_x402_services`: Discover available x402 services (filter by price, keyword, etc.)

## Overview

The x402 protocol enables APIs to require micropayments for access. When a client makes a request to a protected endpoint, the server responds with a `402 Payment Required` status code along with payment instructions.

This provider supports **both v1 and v2 x402 endpoints** automatically.

### Recommended Two-Step Flow (quote-bound)

1. Initial Request:

   - Make request using `make_http_request`
   - If endpoint doesn't require payment, get response immediately
   - If 402 received, the provider freezes the final method, URL, headers, query, exact request bytes, the full payment-required envelope, and one selected USDC requirement matching the wallet network
   - The response includes an opaque `quoteBinding` handle. No payment authority is created on this step.

2. Payment & Retry (if needed):
   - Review payment requirements
   - Use `retry_http_request_with_x402` with the same request and the `quoteBinding` handle
   - The official x402 2.7.0 client is constructed with a `paymentRequirementsSelector` and `onBeforePaymentCreation` hook that accept only the frozen requirement and abort on drift before the signer is invoked
   - Prepared retry creates the payment payload from the frozen requirement and plain-fetches the frozen request once with that payment header. It does **not** call `wrapFetchWithPayment` (that helper re-fetches 402 and can pick a drifted quote).
   - HTTP binding is transport replay of the frozen request bytes. EIP-3009 `transferWithAuthorization` covers payment authorization fields (identity, amount, validity, asset domain, chain), not URL, method, headers, or body.
   - Settled-success requires HTTP 200 and a well-formed payment-response with a nonempty transaction. Post-sign timeout, non-2xx, or missing/malformed payment-response is terminal unreconciled possible-spend with no retry.

Quote-binding bounds:

- TTL: 60 seconds (`QUOTE_BINDING_TTL_MS`)
- Max pending unused approvals: 8 (`QUOTE_BINDING_MAX_PENDING`); oldest is evicted
- Each handle is one-use. Replay, expiry, eviction, or a mismatched request/option refuses without signing.

Missing or malformed payment-response on 200 is not settled-success. If a signature was already created, the action returns possible-spend evidence (never a synthetic transaction id, and never the wording "payment was not settled"). This route requires HTTP 200 plus official settlement identity; it does not validate returned application data against a seller outputSchema or a buyer-owned response schema.

### Direct Payment Flow (Alternative) — not a user-confirmation flow

`make_http_request_with_x402` is still **not** a user-confirmation flow and **not** recipient-screened: payTo is frozen for anti-drift but is not checked against an allowlist or recipient policy. It now freezes the first 402's exact-one wallet-matching USDC requirement (or fails closed before sign). It does **not** call `wrapFetchWithPayment`. After that freeze it signs via `x402HTTPClient.createPaymentPayload` + `encodePaymentSignatureHeader` + a plain fetch of the same request, the same official path as prepared retry. A later 402 is never signed. HTTP binding is transport replay of the inspected request bytes, not EIP-3009 crypto binding of URL/method/body. Prefer the two-step flow when the user should confirm.

Paid delivery success requires official `x402HTTPClient.getPaymentSettleResponse`, `success === true`, a nonempty payer, the exact frozen requirement network, a network-aware transaction identifier (EVM: `0x` + 64 hex; SVM: Bitcoin-alphabet Base58 64-byte signature), and family-correct payer equality (EVM case-insensitive hex; SVM exact case-sensitive Base58). Missing or empty payer/network, arbitrary text such as `"not-a-tx"`, and wrong-family hashes do not promote. After a payment signature, missing, malformed, unsuccessful, wrong-network, transactionless, wrong-payer, or transport-failed settlement evidence is terminal `unreconciled_possible_spend`. Unsigned HTTP 200 with no/null official settlement is not success.

### Workflow with Service Registration

When `allowDynamicServiceRegistration` is enabled, the typical workflow is:

1. **Discover Services**: Use `discover_x402_services` to find available services
2. **Register Service**: Use `register_x402_service` to approve the service URL
3. **Make Request**: Use `make_http_request` to receive 402 response with additional metadata
4. **Handle Payment**: Retry with `retry_http_request_with_x402`

When `allowDynamicServiceRegistration` is disabled, all services must be pre-registered in the configuration.

## Usage

### Service Management Actions

#### `list_registered_services` Action

Lists all service URLs currently approved for x402 requests. No parameters required.

```typescript
// Response example:
{
  "success": true,
  "registeredServices": [
    "https://api.example.com",
    "https://weather.x402.io"
  ],
  "count": 2,
  "allowDynamicServiceRegistration": true
}
```

#### `list_registered_facilitators` Action

Lists all facilitators available for service discovery (known defaults + custom). No parameters required.

```typescript
// Response example:
{
  "success": true,
  "facilitators": [
    { "name": "cdp", "url": "https://...", "type": "known" },
    { "name": "payai", "url": "https://...", "type": "known" },
    { "name": "myFacilitator", "url": "https://...", "type": "custom" }
  ],
  "knownCount": 2,
  "customCount": 1,
  "totalCount": 3
}
```

#### `register_x402_service` Action

Registers a service URL for x402 requests. Only available when `allowDynamicServiceRegistration: true`.

```typescript
const request = { url: "https://api.example.com/data" };
```

### HTTP Request Actions

#### `make_http_request` Action

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

Retries request with payment after 402. Pass the `quoteBinding` from `make_http_request`. Supports both v1 and v2 payment option formats:

```typescript
const request = { url, quoteBinding };

// v1 format (legacy endpoints)
const requestV1 = {
  url: "https://api.example.com/data",
  method: "GET",
  selectedPaymentOption: {
    scheme: "exact",
    network: "base-sepolia",          // v1 network identifier
    maxAmountRequired: "1000",
    asset: "0x..."
  },
  quoteBinding: "opaque-handle-from-make_http_request"
};

// v2 format (CAIP-2 network identifiers)
const requestV2 = {
  url: "https://api.example.com/data",
  method: "GET",
  selectedPaymentOption: {
    scheme: "exact",
    network: "eip155:84532",          // v2 CAIP-2 identifier
    amount: "1000",
    asset: "0x...",
    payTo: "0x..."
  },
  quoteBinding: "opaque-handle-from-make_http_request"
};
```

### `make_http_request_with_x402` Action

Direct payment-enabled requests (use with caution). This path has no separately reviewable user-confirmation handle. It is internally bound to the first inspected 402 exact-one wallet-matching USDC requirement (or fails closed before sign). It is not recipient-screened: payTo is frozen for anti-drift but is not checked against an allowlist or recipient policy.

```typescript
{
  url: "https://api.example.com/data",
  method: "GET",                    // Optional, defaults to GET
  headers: { "Accept": "..." },     // Optional
  body: { ... }                     // Optional
}
```

#### `discover_x402_services` Action

Fetches all available services from the x402 Bazaar with full pagination support. Returns simplified output with url, price, and description for each service.

```typescript
{
  facilitator: "cdp",             // Optional: 'cdp', 'payai', or registered custom facilitator name
                                   // Default: "cdp"
  maxUsdcPrice: 0.1,              // Optional: filter by max price in USDC (default: 1.0)
  keyword: "weather",             // Optional: filter by description/URL keyword
  x402Versions: [1, 2]            // Optional: filter by protocol version
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

**Note**: After discovering a service, use `register_x402_service` to register it before making requests (if `allowDynamicServiceRegistration` is enabled).

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

### Error Responses

The provider returns structured error responses for security violations:

#### Service Not Registered

```json
{
  "error": true,
  "message": "Service not registered",
  "details": "The service URL \"https://...\" is not registered.",
  "registeredServices": ["https://..."],
  "suggestion": "Use register_x402_service to register this service first."
}
```

#### Payment Exceeds Limit

```json
{
  "error": true,
  "message": "Payment exceeds limit",
  "details": "The requested payment of 2.5 USDC exceeds the maximum spending limit of 1.0 USDC.",
  "maxPaymentUsdc": 1.0
}
```

#### Non-USDC Payment

```json
{
  "error": true,
  "message": "Only USDC payments are supported",
  "details": "The selected payment asset \"0x...\" is not USDC."
}
```

## Network Support

The x402 provider supports the following networks:

| Internal Network ID | v1 Identifier   | v2 CAIP-2 Identifier                      |
| ------------------- | --------------- | ----------------------------------------- |
| `base-mainnet`      | `base`          | `eip155:8453`                             |
| `base-sepolia`      | `base-sepolia`  | `eip155:84532`                            |
| `solana-mainnet`    | `solana`        | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `solana-devnet`     | `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

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

### Environment Variables

The following environment variables can be used to configure the provider:

- `X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION`: Set to `"true"` to enable dynamic service registration
- `X402_MAX_PAYMENT_USDC`: Set the maximum payment limit in USDC (e.g., `"0.5"`)

Configuration object values take precedence over environment variables.

### Additional Resources

For more information on the **x402 protocol**, visit the [x402 documentation](https://docs.cdp.coinbase.com/x402/overview).
