from collections.abc import Callable

import requests
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

PYTH_FETCH_PRICE_PROMPT = """
Fetch the price of a given price feed from Pyth. First fetch the price feed ID forusing the pyth_fetch_price_feed_id action.

Inputs:
- Pyth price feed ID

Important notes:
- Do not assume that a random ID is a Pyth price feed ID. If you are confused, ask a clarifying question.
- This action only fetches price inputs from Pyth price feeds. No other source.
- If you are asked to fetch the price from Pyth for a ticker symbol such as BTC, you must first use the pyth_fetch_price_feed_id
action to retrieve the price feed ID before invoking the pyth_Fetch_price action
"""


class PythFetchPriceInput(BaseModel):
    """Input schema for fetching Pyth price."""

    price_feed_id: str = Field(..., description="The price feed ID to fetch the price for.")


def pyth_fetch_price(price_feed_id: str) -> str:
    """Fetch the price of a given price feed from Pyth."""
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


class PythFetchPriceAction(CdpAction):
    """Fetch Pyth Price action."""

    name: str = "pyth_fetch_price"
    description: str = PYTH_FETCH_PRICE_PROMPT
    args_schema: type[BaseModel] | None = PythFetchPriceInput
    func: Callable[..., str] = pyth_fetch_price
