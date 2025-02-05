from collections.abc import Callable

from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

import os
import requests


# NOTE: This action requires ETHERSCAN_API_KEY to be set in the environment.


GET_ABI_PROMPT = """
This tool will get the ABI of the given contract address.
The ABI will be returned as a JSON encoded string.

It takes the following inputs:
- address: The address of the contract to get the ABI for
"""


class GetABIInput(BaseModel):
    """Input argument schema for get ABI action."""

    address: str | None = Field(
        ...,
        description="The address to check balance for. If not provided, uses the wallet's default address",
    )


def get_abi(address: str) -> str:
    """Get ABI for the given contract address.

    Args:
        address (str): The address of the contract to get the ABI for
    
    Returns:
        str: A message containing the ABI of the contract

    """
    abi = requests.get("https://api.etherscan.io/v2/api", params={
        "chainid": "84532",
        "module": "contract",
        "action": "getabi",
        "address": address,
        "apikey": os.getenv("ETHERSCAN_API_KEY"),
    }).json()["result"]
    return abi

class GetABIAction(CdpAction):
    """Get ABI action."""

    name: str = "get_abi"
    description: str = GET_ABI_PROMPT
    args_schema: type[BaseModel] | None = GetABIInput
    func: Callable[..., str] = get_abi
