# x402station Preflight + AgentKit Example

This example shows one way to call [Preflight by x402station.io](https://x402station.io/guard/recipes/agentkit) before an AgentKit-powered agent pays an x402 endpoint.

AgentKit handles wallet access and x402 settlement. x402station.io is an independent pre-payment signal layer: it measures endpoint risk before `PAYMENT-SIGNATURE` is signed.

## What the example does

1. Builds an AgentKit instance with the existing `x402ActionProvider`.
2. Calls the free x402station trial endpoint for a candidate x402 URL.
3. Blocks endpoints with hard risk signals such as `dead`, `zombie`, `decoy_price_extreme`, and `never_paid_zombie`.
4. Only then uses the x402 payment fetcher to call the paid endpoint.

Use the trial endpoint while developing. Production agents should switch `X402STATION_PREFLIGHT_URL` to `https://x402station.io/api/v1/preflight` and pay the small preflight fee or use prepaid credits.

## Prerequisites

- Node.js 20 or higher
- A Base wallet private key with enough USDC for the endpoint you plan to call
- An x402 endpoint URL to evaluate

Create `.env`:

```bash
AGENT_PRIVATE_KEY=0x...
TARGET_X402_URL=https://api.example.com/x402-endpoint
NETWORK_ID=base-mainnet
MAX_X402_PAYMENT_USDC=1
X402STATION_PREFLIGHT_URL=https://x402station.io/api/v1/preflight-trial
```

## Running the example

From the repository root:

```bash
cd typescript
pnpm install
pnpm --filter @coinbase/x402station-preflight-agentkit-example start
```

If preflight returns a blocking signal, the script exits before signing any x402 payment. If preflight passes, the script calls the target URL through AgentKit's existing `X402ActionProvider_make_http_request_with_x402` action.

## Notes

- This is not an endorsement of any merchant or endpoint. The preflight response is a machine-readable risk signal.
- Keep your own budget controls. Preflight is one guardrail, not a substitute for max-payment limits and allowlists.
- Treat softer warnings such as `proxy_markup`, `slow`, or `new_provider` as policy inputs rather than automatic failures.
- For agent workflows, put this check before tools that call `make_http_request_with_x402` or any direct `fetchWithPayment` path.

## Links

- x402station AgentKit recipe: <https://x402station.io/guard/recipes/agentkit>
- x402station OpenAPI: <https://x402station.io/api/openapi.json>
- AgentKit x402 action provider: <../../agentkit/src/action-providers/x402>
