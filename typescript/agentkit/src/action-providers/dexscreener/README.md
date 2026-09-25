# DexScreener Action Provider

Fetch real-time DEX trading data from [DexScreener](https://dexscreener.com) across 80+ blockchains. No API key or authentication required.

## Actions

| Action | Description |
|--------|-------------|
| `search_dexscreener_pairs` | Search for trading pairs by token name, symbol, or address |
| `get_dexscreener_pairs_by_token` | Get all pairs for a token on a specific chain, sorted by 24h volume |
| `get_dexscreener_pair` | Get detailed data for a specific pair by contract address |

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { dexscreenerActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [dexscreenerActionProvider()],
});
```

## Example prompts

```text
Search DexScreener for USDC pairs

Find all trading pairs for WETH on Base

Get DexScreener data for the WETH/USDC pair at 0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C on Base

What is the current price and 24h volume of cbBTC on Base?

Find the most liquid DEX pair for ETH on Arbitrum
```

## Networks

All networks supported — DexScreener aggregates data from 80+ blockchains including Base, Ethereum, Solana, Arbitrum, Polygon, and more.

## Reference

- [DexScreener API Reference](https://docs.dexscreener.com/api/reference)
- [@coinbase/agentkit documentation](https://docs.cdp.coinbase.com/agent-kit/docs/agentkit-overview)
