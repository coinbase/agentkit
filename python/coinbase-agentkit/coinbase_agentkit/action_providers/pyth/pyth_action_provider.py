"""Pyth action provider."""

import json
from typing import Any

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import FetchPriceFeedSchema, FetchPriceSchema


class PythActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with Pyth price feeds."""

    def __init__(self):
        super().__init__("pyth", [])

    @create_action(
        name="fetch_price_feed",
        description="""Fetch the price feed ID for a given token symbol from Pyth.

    Inputs:
    - tokenSymbol: The asset ticker/symbol to fetch the price feed ID for (e.g. BTC, ETH, COIN, XAU, EUR, etc.)
    - quoteCurrency: The quote currency to filter by (defaults to USD)
    - assetType: The asset type to search for (crypto, equity, fx, metal) - defaults to crypto

    Examples:
    - Crypto: BTC, ETH, SOL
    - Equities: COIN, AAPL, TSLA
    - FX: EUR, GBP, JPY
    - Metals: XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)
    """,
        schema=FetchPriceFeedSchema,
    )
    def fetch_price_feed(self, args: dict[str, Any]) -> str:
        """Fetch the price feed ID for a given token symbol from Pyth.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A JSON string containing the action response or error details.

        """
        validated_args = FetchPriceFeedSchema(**args)
        token_symbol = validated_args.token_symbol
        quote_currency = validated_args.quote_currency
        asset_type = validated_args.asset_type

        url = f"https://hermes.pyth.network/v2/price_feeds?query={token_symbol}&asset_type={asset_type}"

        try:
            response = requests.get(url)
            if not response.ok:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"HTTP error! status: {response.status}",
                    }
                )

            data = response.json()

            if not data:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"No price feed found for {token_symbol}",
                    }
                )

            # Filter data by token symbol and quote currency
            filtered_data = [
                item
                for item in data
                if (
                    item["attributes"]["base"].lower() == token_symbol.lower()
                    and item["attributes"]["quote_currency"].lower() == quote_currency.lower()
                )
            ]

            if not filtered_data:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"No price feed found for {token_symbol}/{quote_currency}",
                    }
                )

            # For equities, select the regular feed over special market hours feeds
            selected_feed = filtered_data[0]
            if asset_type == "equity":
                # Look for regular market feed (no PRE, POST, ON, EXT suffixes)
                regular_market_feed = next(
                    (
                        item
                        for item in filtered_data
                        if not any(
                            suffix in item["attributes"]["symbol"]
                            for suffix in [".PRE", ".POST", ".ON", ".EXT"]
                        )
                    ),
                    None,
                )
                if regular_market_feed:
                    selected_feed = regular_market_feed

            return json.dumps(
                {
                    "success": True,
                    "priceFeedID": selected_feed["id"],
                    "tokenSymbol": token_symbol,
                    "quoteCurrency": quote_currency,
                    "feedType": selected_feed["attributes"]["display_symbol"],
                }
            )

        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"Error fetching price feed: {e!s}",
                }
            )

    @create_action(
        name="fetch_price",
        description="""Fetch the price of a price feed from Pyth.

Inputs:
- priceFeedID: Price feed ID (string)

Important notes:
- Do not assume that a random ID is a Pyth price feed ID. If you are confused, ask a clarifying question.
- This action only fetches price inputs from Pyth price feeds. No other source.
- If you are asked to fetch the price from Pyth for a ticker symbol such as BTC, you must first use the fetch_price_feed action to retrieve the price feed ID before invoking the fetch_price action
""",
        schema=FetchPriceSchema,
    )
    def fetch_price(self, args: dict[str, Any]) -> str:
        """Fetch price from Pyth for the given price feed ID.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A JSON string containing the action response or error details.

        """
        try:
            validated_args = FetchPriceSchema(**args)
            price_feed_id = validated_args.price_feed_id
            url = f"https://hermes.pyth.network/v2/updates/price/latest?ids[]={price_feed_id}"
            response = requests.get(url)

            if not response.ok:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"HTTP error! status: {response.status}",
                    }
                )

            data = response.json()
            parsed_data = data["parsed"]

            if not parsed_data:
                return json.dumps(
                    {
                        "success": False,
                        "error": f"No price data found for {price_feed_id}",
                    }
                )

            price_info = parsed_data[0]["price"]
            price = int(price_info["price"])
            exponent = price_info["expo"]

            # Format price
            if exponent < 0:
                adjusted_price = price * 100
                divisor = 10 ** (-exponent)
                scaled_price = adjusted_price // divisor
                price_str = f"{scaled_price // 100}.{scaled_price % 100:02d}"
                formatted_price = price_str if not price_str.startswith(".") else f"0{price_str}"
            else:
                scaled_price = price // (10**exponent)
                formatted_price = str(scaled_price)

            return json.dumps(
                {
                    "success": True,
                    "priceFeedID": price_feed_id,
                    "price": formatted_price,
                }
            )

        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"Error fetching price from Pyth: {e!s}",
                }
            )

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Pyth."""
        return True


def pyth_action_provider() -> PythActionProvider:
    """Create a new Pyth action provider.

    Returns:
        PythActionProvider: A new Pyth action provider instance.

    """
    return PythActionProvider()
