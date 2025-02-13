"""Pyth action provider."""

from typing import Any

import requests
from pydantic import BaseModel, Field

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider


class FetchPriceFeedIdSchema(BaseModel):
    """Input schema for fetching Pyth price feed ID."""

    token_symbol: str = Field(..., description="The token symbol to fetch the price feed ID for.")


class FetchPriceSchema(BaseModel):
    """Input schema for fetching Pyth price."""

    price_feed_id: str = Field(..., description="The Pyth price feed ID to fetch the price for.")


class PythActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with Pyth price feeds."""

    def __init__(self):
        super().__init__("pyth", [])

    @create_action(
        name="fetch_price_feed_id",
        description="Fetch the price feed ID for a given token symbol (e.g. BTC, ETH, etc.) from Pyth.",
        schema=FetchPriceFeedIdSchema,
    )
    def fetch_price_feed_id(self, args: dict[str, Any]) -> str:
        """Fetch the price feed ID for a given token symbol from Pyth.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        token_symbol = args["token_symbol"]
        url = f"https://hermes.pyth.network/v2/price_feeds?query={token_symbol}&asset_type=crypto"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if not data:
            raise ValueError(f"No price feed found for {token_symbol}")

        filtered_data = [
            item for item in data if item["attributes"]["base"].lower() == token_symbol.lower()
        ]
        if not filtered_data:
            raise ValueError(f"No price feed found for {token_symbol}")

        return filtered_data[0]["id"]

    @create_action(
        name="get_price",
        description="""
Fetch the price of a given price feed from Pyth. First fetch the price feed ID using the fetch_price_feed_id action.

Important notes:
- Do not assume that a random ID is a Pyth price feed ID. If you are confused, ask a clarifying question.
- This action only fetches price inputs from Pyth price feeds. No other source.
- If you are asked to fetch the price from Pyth for a ticker symbol such as BTC, you must first use the fetch_price_feed_id action.
""",
        schema=FetchPriceSchema,
    )
    def fetch_price(self, args: dict[str, Any]) -> str:
        """Fetch price from Pyth for the given price feed ID.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            price_feed_id = args["price_feed_id"]
            url = f"https://hermes.pyth.network/v2/updates/price/latest?ids[]={price_feed_id}"
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            parsed_data = data["parsed"]

            if not parsed_data:
                raise ValueError(f"No price data found for {price_feed_id}")

            price_info = parsed_data[0]["price"]
            price = int(price_info["price"])
            exponent = price_info["expo"]

            if exponent < 0:
                adjusted_price = price * 100
                divisor = 10**-exponent
                scaled_price = adjusted_price // divisor
                price_str = f"{scaled_price // 100}.{scaled_price % 100:02}"
                return price_str if not price_str.startswith(".") else f"0{price_str}"

            scaled_price = price // (10**exponent)

            return str(scaled_price)
        except Exception as e:
            return f"Error fetching price from Pyth: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Pyth."""
        return True


def pyth_action_provider() -> PythActionProvider:
    """Create a new Pyth action provider.

    Returns:
        PythActionProvider: A new Pyth action provider instance.

    """
    return PythActionProvider()
