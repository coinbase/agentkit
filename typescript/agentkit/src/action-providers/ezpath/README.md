# EzPath Action Provider

AgentKit action provider for [EZ-Path](https://ezpath.myezverse.xyz) — a pay-per-request DEX meta-router on Base mainnet that races 0x, ParaSwap, Aerodrome, and Uniswap V3 to return the best swap quote.

## How it works

Payment is handled automatically via the [X402 protocol](https://x402.org). On every request the action:

1. Probes the EZ-Path endpoint — receives an HTTP 402 with the live toll address and tier pricing
2. Signs an EIP-3009 `TransferWithAuthorization` using the agent's wallet (no pre-approval or allowance required)
3. Retries with the signed payment in the `X-Payment` header
4. Returns the normalized quote with routing metadata

The agent's USDC balance on Base is debited per request. No subscription, no API key.

## Execution tiers

| Tier | Cost | Routing logic |
|---|---|---|
| `basic` | $0.03 | Direct 0x execution |
| `resilient` | $0.10 | Concurrent race: 0x/ParaSwap vs Aerodrome — highest `buyAmount` wins |
| `institutional` | $0.50 | Race + Uniswap V3 triple-fee-tier safety net if both lanes fail |

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { ezpathActionProvider } from "./ezpath";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [ezpathActionProvider()],
});
```

The `get_swap_quote` action activates on natural-language swap intent:

> *"What's the best rate for 1 USDC → WETH on Base?"*
> *"Get me an institutional-tier quote: sell 1000000 USDC atoms, buy WETH"*

## Prerequisites

- Agent wallet must hold **USDC on Base mainnet** (contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- The EZ-Path relayer settles the on-chain transfer; no ETH is required by the plugin

## Links

- Live endpoint: https://ezpath.myezverse.xyz
- OpenAPI schema: https://ezpath.myezverse.xyz/openapi.json
- Agent manifest: https://ezpath.myezverse.xyz/.well-known/agent.json
