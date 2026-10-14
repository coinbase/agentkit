"""DefiLlama action provider."""

import json
from typing import Any
import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import DEFILLAMA_BASE_URL, DEFILLAMA_PRICES_URL
from .schemas import GetProtocolSchema, GetTokenPricesSchema, SearchProtocolsSchema
from .utils import prune_get_protocol_response


class DefiLlamaActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with DefiLlama API."""

    def __init__(self):
        super().__init__("defillama", [])

    @create_action(
        name="find_protocol",
        description="""This tool will search for DeFi protocols on DefiLlama by name.
It takes:
- query: A search query string to match against protocol names

Important notes:
- The search is case-insensitive
- Returns all protocols whose names contain the search query
- Returns metadata including TVL, chain, category, and other protocol details
- Returns a 'No protocols found' message if no matches are found""",
        schema=SearchProtocolsSchema,
    )
    def find_protocol(self, args: dict[str, Any]) -> str:
        """Search for DeFi protocols on DefiLlama by name."""
        try:
            validated_args = SearchProtocolsSchema(**args)
            url = f"{DEFILLAMA_BASE_URL}/protocols"
            response = requests.get(url, timeout=15)
            if not response.ok:
                return f"Error searching protocols: HTTP error! status: {response.status_code}"

            protocols = response.json()
            query_lower = validated_args.query.lower()
            matching = [
                p
                for p in protocols
                if isinstance(p, dict) and query_lower in p.get("name", "").lower()
            ]

            if not matching:
                return f'No protocols found matching "{validated_args.query}"'

            return json.dumps(matching, indent=2)
        except Exception as e:
            return f"Error searching protocols: {e}"

    @create_action(
        name="get_protocol",
        description="""This tool will fetch detailed information about a specific protocol from DefiLlama.
It takes:
- protocol_id: The protocol identifier from DefiLlama (e.g. uniswap, aave, aerodrome)

Important notes:
- Returns comprehensive data including TVL, description, category, and historical breakdowns
- Prunes time-series data to 5 most recent entries to keep payload size manageable
- Returns an error message if the protocol is not found or request fails""",
        schema=GetProtocolSchema,
    )
    def get_protocol(self, args: dict[str, Any]) -> str:
        """Fetch detailed information about a specific protocol from DefiLlama."""
        try:
            validated_args = GetProtocolSchema(**args)
            url = f"{DEFILLAMA_BASE_URL}/protocol/{validated_args.protocol_id}"
            response = requests.get(url, timeout=15)
            if not response.ok:
                return f"Error fetching protocol information: HTTP error! status: {response.status_code}"

            data = response.json()
            pruned = prune_get_protocol_response(data)
            return json.dumps(pruned, indent=2)
        except Exception as e:
            return f"Error fetching protocol information: {e}"

    @create_action(
        name="get_token_prices",
        description="""This tool will fetch current token prices from DefiLlama.
It takes:
- tokens: A list of token addresses with chain prefix (e.g. ['ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'])
- search_width: Optional time range string (e.g. '4h')

Important notes:
- Token addresses MUST include chain prefix
- Returns current prices, timestamps, confidence, and 24h changes
- Returns an error message if any address is invalid or request fails""",
        schema=GetTokenPricesSchema,
    )
    def get_token_prices(self, args: dict[str, Any]) -> str:
        """Fetch current token prices from DefiLlama."""
        try:
            validated_args = GetTokenPricesSchema(**args)
            tokens_str = ",".join(validated_args.tokens)
            params = {}
            if validated_args.search_width:
                params["searchWidth"] = validated_args.search_width

            url = f"{DEFILLAMA_PRICES_URL}/prices/current/{tokens_str}"
            response = requests.get(url, params=params, timeout=15)
            if not response.ok:
                return f"Error fetching token prices: HTTP error! status: {response.status_code}"

            data = response.json()
            return json.dumps(data, indent=2)
        except Exception as e:
            return f"Error fetching token prices: {e}"

    def supports_network(self, network: Network) -> bool:
        """DefiLlama is network-agnostic and supports all networks."""
        return True


def defillama_action_provider() -> DefiLlamaActionProvider:
    """Create a new DefiLlamaActionProvider instance."""
    return DefiLlamaActionProvider()
