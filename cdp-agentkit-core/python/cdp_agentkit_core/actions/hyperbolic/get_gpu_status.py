from collections.abc import Callable

import requests
from pydantic import BaseModel

from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.hyperbolic.utils import get_api_key

GET_GPU_STATUS_PROMPT = """
This tool will get all the the status and ssh commands of you currently rented GPUs on the Hyperbolic platform.

It does not take any inputs

Important notes:
- Authorization key is required for this operation
- The GPU prices are in CENTS per hour
- If the status is "starting", it means the GPU is not ready yet. You can use the GetGPUStatus Action to check the status again after 5 seconds.
- You can access it through the SSHAccess Action and run commands on it through the RemoteShell Action.
"""


class GetGpuStatusInput(BaseModel):
    """Input argument schema for getting available GPUs."""


def get_gpu_status() -> str:
    """Return a string representation of the response from the Hyperbolic API.

    Returns:
      A string representing the response from the API.

    """
    # Get API key from environment
    api_key = get_api_key()

    url = "https://api.hyperbolic.xyz/v1/marketplace/instances"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    response = requests.get(url, headers=headers)
    return response.json()


class GetGpuStatusAction(CdpAction):
    """Get status for my GPUs action."""

    name: str = "get_gpu_status"
    description: str = GET_GPU_STATUS_PROMPT
    args_schema: type[BaseModel] | None = GetGpuStatusInput
    func: Callable[..., str] = get_gpu_status
