from collections.abc import Callable

from allora_sdk.v2.api_client import AlloraAPIClient
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.allora.action import AlloraAction

GET_PRICE_PREDICTION_PROMPT = """
This tool will get the future price prediction for a given crypto asset from Allora Network.
It takes the crypto asset and timeframe as inputs.
"""


class GetPricePredictionInput(BaseModel):
    """Input argument schema for get price prediction action."""

    token: str = Field(
        ..., description="The crypto asset to get the price prediction for, e.g. `BTC`"
    )
    timeframe: str = Field(
        ..., description="The timeframe to get the price prediction for, e.g. `5m` or `8h`"
    )


async def get_price_prediction(client: AlloraAPIClient, token: str, timeframe: str) -> str:
    """Get the future price prediction for a given crypto asset from Allora Network.

    Args:
        client (AlloraAPIClient): The Allora API client.
        token (str): The crypto asset to get the price prediction for, e.g. `BTC`
        timeframe (str): The timeframe to get the price prediction for, e.g. `5m` or `8h`

    Returns:
        str: The future price prediction for the given crypto asset

    """
    try:
        price_prediction = await client.get_price_prediction(token, timeframe)
        return f"The future price prediction for {token} in {timeframe} is {price_prediction.inference_data.network_inference_normalized}"
    except Exception as e:
        return f"Error getting price prediction: {e}"


class GetPricePredictionAction(AlloraAction):
    """Get price prediction action."""

    name: str = "get_price_prediction"
    description: str = GET_PRICE_PREDICTION_PROMPT
    args_schema: type[BaseModel] | None = GetPricePredictionInput
    func: Callable[..., str] = get_price_prediction
