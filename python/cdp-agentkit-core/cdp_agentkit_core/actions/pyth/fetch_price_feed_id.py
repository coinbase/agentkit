from collections.abc import Callable

import requests
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

PYTH_FETCH_PRICE_FEED_ID_PROMPT = """
Fetch the price feed ID for a given token symbol (e.g. BTC, ETH, etc.) from Pyth.
"""


class PythFetchPriceFeedIDInput(BaseModel):
    """Input schema for fetching Pyth price feed ID."""

    token_symbol: str = Field(..., description="The token symbol to fetch the price feed ID for.")


def pyth_fetch_price_feed_id(token_symbol: str) -> str:
    """Fetch the price feed ID for a given token symbol from Pyth."""
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


class PythFetchPriceFeedIDAction(CdpAction):
    """Pyth Fetch Price Feed ID action."""

    name: str = "pyth_fetch_price_feed_id"
    description: str = PYTH_FETCH_PRICE_FEED_ID_PROMPT
    args_schema: type[BaseModel] | None = PythFetchPriceFeedIDInput
    func: Callable[..., str] = pyth_fetch_price_feed_id
