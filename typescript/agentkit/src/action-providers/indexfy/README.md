# Indexfy Action Provider

This directory contains the Indexfy action provider, which lets agents research, buy and sell [Indexfy](https://indexfy.xyz) crypto index tokens on Base.

Each Indexfy index is an ERC-20 fully backed by a basket of tokens (for example, I5 is BTC 30%, ETH 30%, XRP 18%, SOL 14% and BNB 8%). A buy is one transaction that buys every basket token with USDC and mints index shares at basket value; a sell redeems the shares and sells the basket for USDC. Both revert below a quoted minimum.

## Directory Structure

```
indexfy/
├── constants.ts                  # API URL and Base contract addresses
├── indexfyActionProvider.test.ts # Tests for the provider
├── indexfyActionProvider.ts      # Main provider
├── index.ts                      # Main exports
├── README.md                     # Documentation
├── schemas.ts                    # Action schemas
└── utils.ts                      # Indexfy API client and types
```

## Actions

- `list_indexes`: List indexes with price, TVL, 24h/7d performance and fees
- `get_index`: One index's mandate and holdings, by token address or ticker (e.g. `I5`)
- `get_portfolio`: A wallet's index positions, value, profit/loss and points; defaults to the agent's wallet
- `buy_index`: Buy an index with up to `usdcAmount` USDC; unspent USDC is refunded
- `sell_index`: Sell `shares` of an index, or `"all"`, for USDC

## Network Support

Base mainnet only. The wallet needs USDC on Base and a little ETH for gas.

## How transactions are made

1. The provider asks the public Indexfy API (`https://api.indexfy.xyz/mcp`, no API key) to build the trade for the agent's wallet. The API returns unsigned calls (an approval if needed, then the trade) and a simulation of them at the latest block. It never holds keys or sends transactions.
2. Before signing, the provider checks that the calls are for Base and for this wallet, that every call targets Base USDC, the IndexfyZapper (`0x44154FC4297823e39553649fea8cC6ce2517d7D4`) or the index token itself, and that the simulation didn't revert.
3. The wallet sends each call, waiting for each to confirm before the next.

Swap routes inside a trade go stale within minutes, so the provider builds right before sending. If a trade reverts, calling the action again rebuilds it.

## Configuration

```ts
indexfyActionProvider({
  apiUrl: "https://api.indexfy.xyz/mcp", // default
  allowedTargets: [], // overrides the default USDC + IndexfyZapper allow-list
});
```

No API key is required.
