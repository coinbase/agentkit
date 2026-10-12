"""DexScreener action provider for token and DEX data."""

import json
from typing import Any

import requests

from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetLatestTokensSchema, GetPairSchema, GetTokenPairsSchema, SearchTokenSchema


class DexScreenerActionProvider(ActionProvider[WalletProvider]):
    """Action provider for DexScreener DEX data."""

    def __init__(self):
        super().__init__("dexscreener", [])

    @create_action(
        name="search_tokens",
        description="""Search for tokens on DexScreener by name, symbol, or contract address.
Returns top matching tokens with price, volume, and liquidity data.

Inputs:
- query: Search term (token name, symbol, or contract address)

Example: search for "PEPE" token""",
        schema=SearchTokenSchema,
    )
    def search_tokens(self, args: dict[str, Any]) -> str:
        """Search for tokens on DexScreener."""
        validated = SearchTokenSchema(**args)
        try:
            resp = requests.get(
                f"https://api.dexscreener.com/latest/dex/search/?q={validated.query}",
                timeout=10,
            )
            if not resp.ok:
                return json.dumps({"success": False, "error": f"API returned {resp.status_code}"})

            data = resp.json()
            pairs = data.get("pairs", [])[:5]  # Top 5 results

            results = []
            for pair in pairs:
                results.append({
                    "chain": pair.get("chainId"),
                    "dex": pair.get("dexId"),
                    "base_token": pair.get("baseToken", {}).get("symbol"),
                    "quote_token": pair.get("quoteToken", {}).get("symbol"),
                    "price_usd": pair.get("priceUsd"),
                    "price_native": pair.get("priceNative"),
                    "volume_24h": pair.get("volume", {}).get("h24"),
                    "liquidity_usd": pair.get("liquidity", {}).get("usd"),
                    "price_change_24h": pair.get("priceChange", {}).get("h24"),
                    "pair_address": pair.get("pairAddress"),
                })

            return json.dumps({"success": True, "count": len(results), "pairs": results}, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @create_action(
        name="get_token_pairs",
        description="""Get all trading pairs for a token contract address on DexScreener.
Returns DEX pairs with price, volume, liquidity, and fee info.

Inputs:
- token_address: The contract address of the token""",
        schema=GetTokenPairsSchema,
    )
    def get_token_pairs(self, args: dict[str, Any]) -> str:
        """Get trading pairs for a token."""
        validated = GetTokenPairsSchema(**args)
        try:
            resp = requests.get(
                f"https://api.dexscreener.com/tokens/v1/{validated.token_address}",
                timeout=10,
            )
            if not resp.ok:
                return json.dumps({"success": False, "error": f"API returned {resp.status_code}"})

            pairs = resp.json()[:10]  # Top 10 pairs

            results = []
            for pair in pairs:
                txns = pair.get("txns", {}).get("h24", {})
                results.append({
                    "chain": pair.get("chainId"),
                    "dex": pair.get("dexId"),
                    "pair_address": pair.get("pairAddress"),
                    "base_token": pair.get("baseToken", {}).get("symbol"),
                    "price_usd": pair.get("priceUsd"),
                    "volume_24h": pair.get("volume", {}).get("h24"),
                    "liquidity_usd": pair.get("liquidity", {}).get("usd"),
                    "buys_24h": txns.get("buys"),
                    "sells_24h": txns.get("sells"),
                    "pair_created_at": pair.get("pairCreatedAt"),
                })

            return json.dumps({"success": True, "count": len(results), "pairs": results}, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @create_action(
        name="get_pair_details",
        description="""Get detailed info for a specific DEX trading pair on DexScreener.

Inputs:
- pair_address: The address of the trading pair
- chain_id: The chain (e.g., 'base', 'ethereum', 'solana')""",
        schema=GetPairSchema,
    )
    def get_pair_details(self, args: dict[str, Any]) -> str:
        """Get pair details."""
        validated = GetPairSchema(**args)
        try:
            resp = requests.get(
                f"https://api.dexscreener.com/pairs/v1/{validated.chain_id}/{validated.pair_address}",
                timeout=10,
            )
            if not resp.ok:
                return json.dumps({"success": False, "error": f"API returned {resp.status_code}"})

            pair = resp.json()
            return json.dumps({"success": True, "pair": pair}, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @create_action(
        name="get_latest_base_tokens",
        description="""Get the latest trending tokens on Base chain from DexScreener.
Useful for discovering new tokens and monitoring the Base ecosystem.

No inputs required - defaults to Base chain.""",
        schema=GetLatestTokensSchema,
    )
    def get_latest_tokens(self, args: dict[str, Any]) -> str:
        """Get latest tokens on a chain."""
        validated = GetLatestTokensSchema(**args)
        try:
            resp = requests.get(
                f"https://api.dexscreener.com/token-profiles/latest/v1",
                timeout=10,
            )
            if not resp.ok:
                return json.dumps({"success": False, "error": f"API returned {resp.status_code}"})

            tokens = resp.json()
            # Filter by chain
            chain_tokens = [
                t for t in tokens
                if t.get("chainId") == validated.chain_id
            ][:20]

            return json.dumps({
                "success": True,
                "chain": validated.chain_id,
                "count": len(chain_tokens),
                "tokens": chain_tokens,
            }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


def dexscreener() -> DexScreenerActionProvider:
    """Create a DexScreenerActionProvider instance."""
    return DexScreenerActionProvider()
