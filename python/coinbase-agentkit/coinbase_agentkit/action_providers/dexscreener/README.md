# DexScreener Action Provider

This action provider gives AI agents access to real-time DEX data from [DexScreener](https://dexscreener.com).

## Features

- **Search tokens** by name, symbol, or contract address
- **Get trading pairs** for any token contract
- **Get pair details** with price, volume, and liquidity
- **Discover latest tokens** on any supported chain (Base, Ethereum, Solana, etc.)

## No API Key Required

DexScreener's public API is free and requires no authentication.

## Usage

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit.action_providers.dexscreener import dexscreener

agentkit = AgentKit()
agentkit.add_action_provider(dexscreener())
```

## Actions

| Action | Description |
|--------|-------------|
| `search_tokens` | Search by name/symbol/address |
| `get_token_pairs` | Get all pairs for a token |
| `get_pair_details` | Detailed pair info |
| `get_latest_base_tokens` | Trending tokens on a chain |
