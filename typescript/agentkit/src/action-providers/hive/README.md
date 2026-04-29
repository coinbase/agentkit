# HiveActionProvider

This directory contains the **HiveActionProvider** for Coinbase AgentKit, exposing [Hive Civilization's](https://github.com/srotzin) ~50 x402-wired revenue surfaces to any agent built on AgentKit.

All Hive services run on **Base mainnet** and accept **USDC micro-payments** via the [x402 protocol](https://github.com/coinbase/x402). No API keys, no OAuth, no subscriptions.

## Directory Structure

```
hive/
├── hiveActionProvider.ts   # ActionProvider class — four actions
├── schemas.ts              # Zod schemas and HiveConfig type
├── constants.ts            # Treasury address, chain ID, USDC contract, etc.
├── index.ts                # Exports
└── README.md               # This file
```

## Quick Start

```typescript
import { AgentKit, hiveActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,                  // Must be an EvmWalletProvider on Base mainnet
  actionProviders: [hiveActionProvider()],
});
```

## Configuration

`hiveActionProvider` accepts an optional `HiveConfig` object:

```typescript
import { hiveActionProvider, HiveConfig } from "@coinbase/agentkit";

const config: HiveConfig = {
  // Maximum USDC per call (all Hive services are ≤ $0.05)
  // Default: 0.10 (10 cents) or HIVE_MAX_PAYMENT_USDC env var
  maxPaymentUsdc: 0.05,
};

const provider = hiveActionProvider(config);
```

**Environment variable override:**

```
HIVE_MAX_PAYMENT_USDC=0.05
```

## Actions

### `hive_discover_services`

Fetches the live Hive service catalog from `hivegate`. Free read — no payment required.

```typescript
// No parameters. Returns:
{
  success: true,
  source: "https://hivegate.onrender.com/v1/discovery/agents",
  treasury: "0x15184bf50b3d3f52b60434f8942b7d52f2eb436e",
  chain: "Base mainnet (8453)",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  catalog: [ /* ... list of services ... */ ]
}
```

### `hive_call_service`

Generic x402-paid call wrapper. Handles the 402 challenge → sign → retry cycle automatically.

| Parameter | Type | Description |
|-----------|------|-------------|
| `serviceUrl` | `string` | Full URL of the Hive service endpoint |
| `toolName` | `string` | MCP tool name (e.g. `submit_job`) |
| `toolArgs` | `object \| null` | Arguments passed to the tool |
| `method` | `GET \| POST \| PUT \| PATCH \| null` | HTTP method (defaults to `POST`) |

```typescript
// Example: call the Hive MCP Evaluator
{
  serviceUrl: "https://hive-mcp-evaluator.onrender.com/mcp",
  toolName: "submit_job",
  toolArgs: { prompt: "Evaluate this text", text: "Hello world" }
}
```

Response:

```json
{
  "success": true,
  "serviceUrl": "https://hive-mcp-evaluator.onrender.com/mcp",
  "toolName": "submit_job",
  "data": { /* service result */ },
  "paymentProof": { /* x402 payment receipt */ },
  "treasury": "0x15184bf50b3d3f52b60434f8942b7d52f2eb436e"
}
```

### `hive_get_treasury_info`

Returns Hive treasury address, chain, USDC contract, and brand info. Useful for agents that want to verify payment destinations before authorizing a spend.

```typescript
// No parameters. Returns:
{
  "success": true,
  "treasury": {
    "address": "0x15184bf50b3d3f52b60434f8942b7d52f2eb436e",
    "chain": "Base mainnet",
    "chainId": 8453,
    "networkId": "base-mainnet"
  },
  "usdc": {
    "contract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "chain": "Base mainnet",
    "chainId": 8453
  },
  "brand": {
    "gold": "#C08D23",
    "github": "https://github.com/srotzin",
    "discoveryUrl": "https://hivegate.onrender.com/v1/discovery/agents"
  },
  "maxPaymentUsdc": 0.10,
  "note": "All Hive services cost ≤ $0.05 USDC per call..."
}
```

### `hive_evaluator_submit_job`

Concrete example action that submits a job to the **Hive MCP Evaluator** at `$0.01 USDC`. Copy this pattern for other Hive tools.

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobPayload` | `object` | The job payload to submit to the evaluator |

```typescript
// Example payload:
{
  jobPayload: {
    model: "gpt-4o",
    prompt: "Evaluate this text for clarity",
    text: "Hello world"
  }
}
```

Sample receipt: `rcpt_76fceca973da4ec0`

## Network Support

HiveActionProvider supports **Base mainnet only** (`networkId: "base-mainnet"`, `chainId: 8453`).

| Field | Value |
|-------|-------|
| Chain | Base mainnet |
| Chain ID | 8453 |
| USDC contract | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Treasury | `0x15184bf50b3d3f52b60434f8942b7d52f2eb436e` |
| Protocol | x402 (EVM exact scheme) |

## How x402 Payments Work

When `hive_call_service` sends a request:

1. The Hive server responds `402 Payment Required` with payment details in the response body or `PAYMENT-REQUIRED` header.
2. `@x402/fetch` signs a USDC transfer with the agent's EVM wallet.
3. The request is retried with the signed payment header.
4. The server verifies the payment on-chain and returns the result.
5. A payment receipt is included in the `PAYMENT-RESPONSE` header.

This is identical to how the existing `make_http_request_with_x402` action works — HiveActionProvider wraps the same `@x402/fetch` library.

## Public Catalog

- **41 MCP shims** published at [github.com/srotzin](https://github.com/srotzin), all at v1.0.0.
- Conformance suite: [github.com/srotzin/hive-x402-conformance](https://github.com/srotzin/hive-x402-conformance) (independent, not affiliated with Coinbase).

## Dependencies

This provider uses the same x402 libraries already bundled with AgentKit:

- `@x402/fetch` — payment-wrapped fetch
- `@x402/evm` — EVM exact payment scheme (Base mainnet)
