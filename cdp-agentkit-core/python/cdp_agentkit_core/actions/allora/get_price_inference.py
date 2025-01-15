from collections.abc import Callable

from allora_sdk.v2.api_client import AlloraAPIClient
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.allora.action import AlloraAction

GET_PRICE_INFERENCE_PROMPT = """
This tool will get the future price inference for a given crypto asset from Allora Network.
It takes the crypto asset and timeframe as inputs.
"""


class GetPriceInferenceInput(BaseModel):
    """Input argument schema for get price inference action."""

    token: str = Field(
        ..., description="The crypto asset to get the price inference for, e.g. `BTC`"
    )
    timeframe: str = Field(
        ..., description="The timeframe to get the price inference for, e.g. `5m` or `8h`"
    )


async def get_price_inference(client: AlloraAPIClient, token: str, timeframe: str) -> str:
    """Get the future price inference for a given crypto asset from Allora Network.

    Args:
        client (AlloraAPIClient): The Allora API client.
        token (str): The crypto asset to get the price inference for, e.g. `BTC`
        timeframe (str): The timeframe to get the price inference for, e.g. `5m` or `8h`

    Returns:
        str: The future price inference for the given crypto asset

    """
    try:
        price_inference = await client.get_price_inference(token, timeframe)
        return f"The future price inference for {token} in {timeframe} is {price_inference.inference_data.network_inference_normalized}"
    except Exception as e:
        return f"Error getting price inference: {e}"


class GetPriceInferenceAction(AlloraAction):
    """Get price inference action."""

    name: str = "get_price_inference"
    description: str = GET_PRICE_INFERENCE_PROMPT
    args_schema: type[BaseModel] | None = GetPriceInferenceInput
    func: Callable[..., str] = get_price_inference
