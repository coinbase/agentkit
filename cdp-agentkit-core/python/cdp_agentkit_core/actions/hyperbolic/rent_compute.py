import json
from collections.abc import Callable

import requests
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.hyperbolic.utils import get_api_key

RENT_COMPUTE_PROMPT = """
This tool will allow you to rent a GPU machine on Hyperbolic platform.

It takes the following inputs:
- cluster_name: Which cluster the node is on
- node_name: Which node the user wants to rent
- gpu_count: How many GPUs the user wants to rent

Important notes:
- All inputs must be recognized in order to process the rental
- If the inputs are not recognized, automatically use the GetAvailableGpus Action to get the available GPUs
- After renting, you will be able to find it through the GetGPUStatus Action, access it through the SSHAccess Action and run commands on it through the RemoteShell Action.
"""


class RentComputeInput(BaseModel):
    """Input argument schema for compute rental action."""

    cluster_name: str = Field(..., description="The cluster name that the user wants to rent from")
    node_name: str = Field(
        ...,
        description="The node ID that the user wants to rent",
    )
    gpu_count: int = Field(
        ...,
        description="The amount of GPUs that the user wants to rent from the node",
    )


def rent_compute(cluster_name: str, node_name: str, gpu_count: int) -> str:
    """Create a marketplace instance using the Hyperbolic API and return the response as a formatted string.

    Args:
        cluster_name (str): Name of the cluster to create
        node_name (str): Name of the node
        gpu_count (int): Number of GPUs to allocate

    Returns:
        str: A formatted string representation of the API response

    Raises:
        requests.exceptions.RequestException: If the API request fails
        ValueError: If required parameters are invalid

    """
    # Input validation
    if not cluster_name or not node_name or not gpu_count:
        raise ValueError("cluster_name, node_name, and gpu_count are required")

    # Get API key from environment
    api_key = get_api_key()

    # Prepare the request
    endpoint = "https://api.hyperbolic.xyz/v1/marketplace/instances/create"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    payload = {"cluster_name": cluster_name, "node_name": node_name, "gpu_count": int(gpu_count)}

    try:
        # Make the request
        response = requests.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()

        # Get the response content
        response_data = response.json()

        # Convert the response to a formatted string
        # We use json.dumps with indent=2 for pretty printing
        formatted_response = json.dumps(response_data, indent=2)

        return formatted_response

    except requests.exceptions.RequestException as e:
        # For HTTP errors, we want to include the status code and response content if available
        error_message = f"Error renting compute from Hyperbolic marketplace: {e!s}"
        if hasattr(e, "response") and e.response is not None:
            try:
                # Try to get JSON error message if available
                error_content = e.response.json()
                error_message += f"\nResponse: {json.dumps(error_content, indent=2)}"
            except json.JSONDecodeError:
                # If response isn't JSON, include the raw text
                error_message += f"\nResponse: {e.response.text}"

        raise requests.exceptions.RequestException(error_message) from e


class RentComputeAction(CdpAction):
    """Rent compute action."""

    name: str = "rent_compute"
    description: str = RENT_COMPUTE_PROMPT
    args_schema: type[BaseModel] | None = RentComputeInput
    func: Callable[..., str] = rent_compute
