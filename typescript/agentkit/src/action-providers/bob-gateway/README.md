# BOB Gateway Action Provider

Swap EVM tokens to native BTC via [BOB Gateway](https://docs.gobob.xyz/gateway/overview).

## Directory Structure

```
bob-gateway/
├── bobGatewayActionProvider.ts       # Main provider with three actions
├── bobGatewayActionProvider.test.ts  # Tests for the action provider
├── gatewayClient.ts                  # API client wrapping BOB Gateway REST endpoints
├── gatewayClient.test.ts             # Tests for the API client
├── schemas.ts                        # Zod input schemas
├── index.ts                          # Exports
└── README.md
```

## Actions

- `get_supported_routes` - List available EVM to BTC swap routes with resolved token symbols and contract addresses
- `swap_to_btc` - Swap an ERC-20 token to native BTC. Checks balance, approves spending, executes the swap, and registers the transaction with the gateway
- `get_orders` - Check order status by order ID, Bitcoin tx ID, or EVM tx hash. Omit the ID to list all orders for the connected wallet

## Configuration

```typescript
import { bobGatewayActionProvider } from "@coinbase/agentkit";

// Default (mainnet)
const provider = bobGatewayActionProvider();

// Custom base URL and affiliate tracking
const provider = bobGatewayActionProvider({
  baseUrl: "https://gateway-api-mainnet.gobob.xyz",
  affiliateId: "your-affiliate-id",
});
```

## ETH Requirement

BOB Gateway offramp transactions require the sender to include a small amount of native ETH (typically ~0.0005 ETH) as `msg.value` to cover bridge/solver inclusion fees. If the wallet has no native ETH, the transaction will revert. Ensure the wallet is funded with ETH before calling `swap_to_btc`, or swap a small amount of an ERC-20 (e.g. USDC) to ETH first.

## Network Support

The provider accepts any EVM network. The source chain is resolved dynamically from the wallet's network ID by matching against chains returned by the Gateway API's `/v1/get-routes` endpoint (e.g. `base-mainnet` resolves to `base`).

If a requested token or chain is not supported, the error message lists available options with resolved token symbols.

## Slippage

Slippage is specified in basis points (default 300 = 3%, max 1000 = 10%). The value is passed to the Gateway API which enforces it during quoting.

## Amounts

All amounts use whole (human-readable) units: `"100"` for 100 USDC, `"0.5"` for 0.5 WBTC. The provider fetches token decimals on-chain and converts internally.

## Gateway API Endpoints Used

| Endpoint | Method | Used by |
|---|---|---|
| `/v1/get-routes` | GET | `get_supported_routes`, `swap_to_btc` |
| `/v1/get-quote` | GET | `swap_to_btc` |
| `/v1/create-order` | POST | `swap_to_btc` |
| `/v1/register-tx` | PATCH | `swap_to_btc` |
| `/v1/get-order/{id}` | GET | `get_orders` (single order) |
| `/v1/get-orders/{address}` | GET | `get_orders` (all wallet orders) |

See the [BOB Gateway API reference](https://docs.gobob.xyz/api-reference/overview) for details.
