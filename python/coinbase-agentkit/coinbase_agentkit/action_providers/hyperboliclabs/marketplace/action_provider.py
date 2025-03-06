"""Hyperbolic Marketplace action provider.

This module provides actions for interacting with Hyperbolic marketplace services.
It includes functionality for managing GPU instances and SSH access.
"""

from typing import Any

from ...action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    GetAvailableGpusByTypeSchema,
    GetAvailableGpusSchema,
    GetAvailableGpusTypesSchema,
    GetGpuStatusSchema,
    RentComputeSchema,
    TerminateComputeSchema,
)
from .service import MarketplaceService
from .utils import (
    format_all_gpu_instances,
    format_gpu_instances_by_type,
    format_gpu_status,
    format_gpu_types,
    format_rent_compute_response,
    format_terminate_compute_response,
)


class MarketplaceActionProvider(ActionProvider):
    """Provides actions for interacting with Hyperbolic marketplace.

    This provider enables interaction with the Hyperbolic marketplace for GPU compute resources.
    It requires an API key which can be provided directly or through the HYPERBOLIC_API_KEY
    environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic marketplace action provider.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        super().__init__("hyperbolic_marketplace", [], api_key=api_key)
        self.marketplace = MarketplaceService(self.api_key)

    @create_action(
        name="get_available_gpus",
        description="""
This tool retrieves all the available GPU machines on the Hyperbolic platform.

It does not take any inputs.

Example successful response:
    Cluster: us-east-1
    Node ID: node-123
    GPU Model: NVIDIA A100
    Available GPUs: 4/8
    Price: $2.50/hour per GPU

Example error response:
    Error: API request failed
    Error: Invalid authentication credentials
    Error: Rate limit exceeded

Important notes:
- The GPU prices are shown in dollars per hour
- Only non-reserved and available GPU instances are returned
- GPU availability is real-time and may change between queries
""",
        schema=GetAvailableGpusSchema,
    )
    def get_available_gpus(self, args: dict[str, Any]) -> str:
        """Retrieve available GPU instances from the marketplace.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        GetAvailableGpusSchema(**args)

        try:
            response = self.marketplace.get_available_instances()

            if not response.instances:
                return "No available GPU instances found."

            return format_all_gpu_instances(response.instances)

        except Exception as e:
            return f"Error: GPU retrieval: {e!s}"

    @create_action(
        name="get_available_gpus_types",
        description="""
This tool retrieves all the available GPU types/models on the Hyperbolic platform.

It does not take any inputs.

Example successful response:
    Available GPU Types:
    - NVIDIA-GeForce-RTX-3070
    - NVIDIA-GeForce-RTX-3080
    - NVIDIA-GeForce-RTX-4090
    - NVIDIA-H100-80GB-HBM3

Example error response:
    Error: API request failed

Important notes:
- Only models with available GPUs are listed
- GPU availability is real-time and may change between queries
- The GPU model names include manufacturer and specific model details
""",
        schema=GetAvailableGpusTypesSchema,
    )
    def get_available_gpus_types(self, args: dict[str, Any]) -> str:
        """Retrieve available GPU types/models from the marketplace.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        GetAvailableGpusTypesSchema(**args)

        try:
            response = self.marketplace.get_available_instances()

            if not response.instances:
                return "No available GPU instances found."

            return format_gpu_types(response.instances)

        except Exception as e:
            return f"Error: GPU types retrieval: {e!s}"

    @create_action(
        name="get_available_gpus_by_type",
        description="""
This tool retrieves all available GPU machines of a specific model on the Hyperbolic platform.

Required inputs:
- gpu_model: The GPU model to filter by (e.g., "NVIDIA-GeForce-RTX-4090")

Example successful response:
    Available NVIDIA-GeForce-RTX-4090 GPU Options:

    Cluster: growing-rosemary-dragonfly
    Node ID: antalpha-super-server-100194
    GPU Model: NVIDIA-GeForce-RTX-4090
    Available GPUs: 1/8
    Price: $0.35/hour per GPU
    ----------------------------------------

    Cluster: webbed-peperomia-magpie
    Node ID: las1-prd-acl-msi-07.fen.intra
    GPU Model: NVIDIA-GeForce-RTX-4090
    Available GPUs: 1/4
    Price: $0.30/hour per GPU
    ----------------------------------------

Example error response:
    Error: API request failed
    Error: No available GPU instances with the model 'NVIDIA-GeForce-RTX-4090' found

Important notes:
- GPU model name must be exact (including hyphens)
- Only available instances are shown
- Availability is real-time and may change
""",
        schema=GetAvailableGpusByTypeSchema,
    )
    def get_available_gpus_by_type(self, args: dict[str, Any]) -> str:
        """Retrieve available GPU instances of a specific model from the marketplace.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = GetAvailableGpusByTypeSchema(**args)
        gpu_model = validated_args.gpu_model

        try:
            response = self.marketplace.get_available_instances()

            if not response.instances:
                return "No available GPU instances found."

            return format_gpu_instances_by_type(response.instances, gpu_model)

        except Exception as e:
            return f"Error: GPU retrieval: {e!s}"

    @create_action(
        name="get_gpu_status",
        description="""
This tool retrieves the status and SSH commands for your currently rented GPUs on the Hyperbolic platform.

It does not take any inputs.

Example successful response:
    Your Rented GPU Instances:
    Instance ID: mortified-morningglory-wombat
    Status: running (Ready to use)
    GPU Model: NVIDIA-GeForce-RTX-4090
    GPU Count: 1
    GPU Memory: 24.0 GB
    SSH Command: ssh ubuntu@mortified-morningglory-wombat.1.cricket.hyperbolic.xyz -p 31065
    ----------------------------------------

    SSH Connection Instructions:
    1. Wait until instance status is 'running'
    2. Use the ssh_connect action with the provided host and username
    3. Once connected, use remote_shell to execute commands

Example error response:
    Error: API request failed
    No rented GPU instances found.

Important notes:
- If status is "starting", the GPU is not ready yet - check again in a few seconds
- Once status is "running", you can use the SSH command to access the instance
""",
        schema=GetGpuStatusSchema,
    )
    def get_gpu_status(self, args: dict[str, Any]) -> str:
        """Retrieve status and SSH commands for currently rented GPUs.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        GetGpuStatusSchema(**args)

        try:
            response = self.marketplace.get_rented_instances()

            if not response.instances:
                return "No rented GPU instances found."

            output = ["Your Rented GPU Instances:"]
            for _i, instance in enumerate(response.instances):
                formatted = format_gpu_status(instance)
                output.append(formatted)
                output.append("-" * 40)

            output.extend(
                [
                    "\nSSH Connection Instructions:",
                    "1. Wait until instance status is 'running'",
                    "2. Use the ssh_connect action with the provided host and username",
                    "3. Once connected, use remote_shell to execute commands",
                ]
            )

            return "\n".join(output)

        except Exception as e:
            return f"Error: GPU status retrieval: {e!s}"

    @create_action(
        name="rent_compute",
        description="""
This tool rents a GPU machine on Hyperbolic platform.

Required inputs:
- cluster_name: Which cluster the node is on
- node_name: Which node to rent
- gpu_count: How many GPUs to rent

Example successful response:
    {
      "status": "success",
      "instance_name": "mortified-morningglory-wombat"
    }

    Next Steps:
    1. Your GPU instance is being provisioned
    2. Use get_gpu_status to check when it's ready
    3. Once status is 'running', you can:
       - Connect via SSH
       - Run remote commands

Example error response:
    Error: Invalid cluster name
    Error: Node not available
    Error: API request failed

Important notes:
- Use get_available_gpus_by_type to find available GPUs of a specific model
- Use get_available_gpus for valid cluster and node names
- Do not ask for a duration, it is not needed
""",
        schema=RentComputeSchema,
    )
    def rent_compute(self, args: dict[str, Any]) -> str:
        """Rents a GPU machine on the platform.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = RentComputeSchema(**args)

        try:
            response = self.marketplace.rent_instance(validated_args)

            return format_rent_compute_response(response)

        except Exception as e:
            return f"Error: Compute rental: {e!s}"

    @create_action(
        name="terminate_compute",
        description="""
This tool terminates a GPU instance on the Hyperbolic platform.

Required inputs:
- id: The ID of the instance to terminate (e.g., "mortified-morningglory-wombat")

Example successful response:
    {
      "status": "success",
      "message": null,
      "error_code": null
    }

    Next Steps:
    1. Your GPU instance has been terminated
    2. Any active SSH connections have been closed
    3. You can check your spend history with get_spend_history
    4. To rent a new instance, use get_available_gpus and rent_compute

Example error response:
    Error: Instance not found
    Error: Instance already terminated
    Error: API request failed

Important notes:
- The instance ID must be valid and active
- After termination, the instance will no longer be accessible
- You can get instance IDs using get_gpu_status
- You can immediately terminate an instance
- Terminated instances will still appear in your spend history
""",
        schema=TerminateComputeSchema,
    )
    def terminate_compute(self, args: dict[str, Any]) -> str:
        """Terminates a GPU instance on the platform.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = TerminateComputeSchema(**args)

        try:
            response = self.marketplace.terminate_instance(validated_args)

            return format_terminate_compute_response(response)

        except Exception as e:
            return f"Error: Compute termination: {e!s}"


def hyperbolic_marketplace_action_provider(
    api_key: str | None = None,
) -> MarketplaceActionProvider:
    """Create a new instance of the MarketplaceActionProvider.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        A new Marketplace action provider instance.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return MarketplaceActionProvider(api_key=api_key)
