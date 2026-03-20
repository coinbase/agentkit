"""x402search action provider."""

import json
from typing import Any

from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402 import x402ClientSync

from ...network import Network
from ...wallet_providers import WalletProvider
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import SearchApisSchema

X402SEARCH_URL = "https://x402search.xyz/v1/search"


class X402SearchActionProvider(ActionProvider[WalletProvider]):
    """Provides natural language search across 14,000+ indexed API services via x402search.

    Coinbase Bazaar lists services. x402search searches them by capability.
    Cost: $0.01 USDC per query via x402 protocol on Base mainnet.
    """

    def __init__(self):
        super().__init__("x402search", [])

    @create_action(
        name="search_apis",
        description="""Search for API services and data providers by natural language capability query.

Searches 14,000+ indexed APIs across crypto, DeFi, NFT, weather, finance, AI, and more.
Returns matching services with names, descriptions, and endpoints.
Cost: $0.01 USDC per query via x402 protocol on Base mainnet — paid automatically.

Use this when an agent needs to discover what APIs exist for a given capability.
Coinbase Bazaar lists services. x402search searches them by capability — they are complementary.

Examples:
- search_apis("token price") -> 88 results including CoinGecko, CryptoCompare
- search_apis("crypto market data") -> 10 focused results
- search_apis("NFT metadata") -> NFT-related APIs
- search_apis("btc price") -> 8 targeted results
""",
        schema=SearchApisSchema,
    )
    def search_apis(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Search x402search for API services matching the natural language query.

        Args:
            wallet_provider: The wallet provider used to authorize x402 payment.
            args: Input arguments containing query and optional limit.

        Returns:
            str: A JSON string containing matched API services or error details.

        """
        validated = SearchApisSchema(**args)

        if not isinstance(wallet_provider, EvmWalletProvider):
            return json.dumps({
                "success": False,
                "error": "x402search requires an EvmWalletProvider with USDC on Base mainnet (eip155:8453).",
            })

        try:
            client = x402ClientSync()
            signer = wallet_provider.to_signer()
            register_exact_evm_client(client, EthAccountSigner(signer))
            session = x402_requests(client)

            response = session.get(
                X402SEARCH_URL,
                params={"q": validated.query},
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()

        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"x402search request failed: {e}",
                "hint": "Ensure the wallet has USDC on Base mainnet (eip155:8453).",
            })

        results = data.get("results", data) if isinstance(data, dict) else data
        if not isinstance(results, list):
            return json.dumps({"success": False, "error": "Unexpected response format."})

        results = results[: validated.limit]

        if not results:
            return json.dumps({
                "success": True,
                "query": validated.query,
                "results": [],
                "message": (
                    f"No APIs found for '{validated.query}'. "
                    "Try broader terms: 'crypto' returns 112 results, 'token price' returns 88."
                ),
            })

        formatted = []
        for r in results:
            formatted.append({
                "name": r.get("name") or r.get("api_name", ""),
                "description": r.get("description") or r.get("accepts", ""),
                "url": r.get("url") or r.get("base_url", ""),
            })

        return json.dumps({
            "success": True,
            "query": validated.query,
            "count": len(formatted),
            "results": formatted,
        }, indent=2)

    def supports_network(self, network: Network) -> bool:
        """x402search works with any EVM wallet; payment settles on Base mainnet."""
        return True


def x402search_action_provider() -> X402SearchActionProvider:
    """Create a new x402search action provider.

    Returns:
        X402SearchActionProvider: A new x402search action provider instance.

    """
    return X402SearchActionProvider()
