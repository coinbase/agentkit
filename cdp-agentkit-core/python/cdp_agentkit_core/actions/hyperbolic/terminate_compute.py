import json
from collections.abc import Callable

import requests
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.cdp_action import CdpAction
from cdp_agentkit_core.actions.hyperbolic.utils import get_api_key

TERMINATE_COMPUTE_PROMPT = """
This tool allows you to terminate a GPU instance on the Hyperbolic platform.
It takes the following input:
- instance_id: The ID of the instance to terminate (e.g., "respectful-rose-pelican")
Important notes:
- The instance ID must be valid and active
- After termination, the instance will no longer be accessible
- You can get instance IDs using the GetGPUStatus Action
"""


class TerminateComputeInput(BaseModel):
    """Input argument schema for compute termination action."""

    instance_id: str = Field(..., description="The ID of the instance to terminate")


def terminate_compute(instance_id: str) -> str:
    """Terminates a marketplace instance using the Hyperbolic API.

    Args:
        instance_id (str): ID of the instance to terminate
    Returns:
        str: A formatted string representation of the API response
    Raises:
        requests.exceptions.RequestException: If the API request fails
        ValueError: If required parameters are invalid

    """
    # Input validation
    if not instance_id:
        raise ValueError("instance_id is required")

    # Get API key from environment
    api_key = get_api_key()

    # Prepare the request
    endpoint = "https://api.hyperbolic.xyz/v1/marketplace/instances/terminate"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    payload = {"id": instance_id}

    try:
        # Make the request
        response = requests.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()

        # Get the response content
        response_data = response.json()

        # Convert the response to a formatted string
        formatted_response = json.dumps(response_data, indent=2)

        return formatted_response

    except requests.exceptions.RequestException as e:
        # For HTTP errors, include the status code and response content if available
        error_message = f"Error terminating compute instance: {e!s}"
        if hasattr(e, "response") and e.response is not None:
            try:
                error_content = e.response.json()
                error_message += f"\nResponse: {json.dumps(error_content, indent=2)}"
            except json.JSONDecodeError:
                error_message += f"\nResponse: {e.response.text}"

        raise requests.exceptions.RequestException(error_message) from e


class TerminateComputeAction(CdpAction):
    """Terminate compute action."""

    name: str = "terminate_compute"
    description: str = TERMINATE_COMPUTE_PROMPT
    args_schema: type[BaseModel] | None = TerminateComputeInput
    func: Callable[..., str] = terminate_compute
