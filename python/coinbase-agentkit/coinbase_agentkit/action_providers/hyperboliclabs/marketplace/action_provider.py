"""Hyperbolic Marketplace action provider.

This module provides actions for interacting with Hyperbolic marketplace services.
It includes functionality for managing GPU instances and SSH access.
"""

from typing import Any

from ....network import Network
from ...action_decorator import create_action
from ...action_provider import ActionProvider
from .schemas import (
    GetAvailableGpusSchema,
    GetGpuStatusSchema,
    RemoteShellSchema,
    RentComputeSchema,
    SSHAccessSchema,
    TerminateComputeSchema,
)
from .service import MarketplaceService
from .utils import (
    format_gpu_instance,
    format_gpu_status,
    format_rent_compute_response,
    format_terminate_compute_response,
    get_api_key,
    ssh_manager,
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
        super().__init__("hyperbolic_marketplace", [])

        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        self.marketplace = MarketplaceService(self.api_key)

    @create_action(
        name="get_available_gpus",
        description="""
This tool will get all the available GPU machines on the Hyperbolic platform.

It does not take any inputs.

A successful response will return a formatted list of available GPU machines with details like:
    Cluster: us-east-1
    Node ID: node-123
    GPU Model: NVIDIA A100
    Available GPUs: 4/8
    Price: $2.50/hour per GPU

A failure response will return an error message like:
    Error retrieving available GPUs: API request failed
    Error retrieving available GPUs: Invalid authentication credentials
    Error retrieving available GPUs: Rate limit exceeded

Important notes:
- Authorization key is required for this operation
- The GPU prices are shown in dollars per hour
- Only non-reserved and available GPU instances are returned
- GPU availability is real-time and may change between queries
""",
        schema=GetAvailableGpusSchema,
    )
    def get_available_gpus(self, args: dict[str, Any]) -> str:
        """Get available GPU instances from the marketplace.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the available GPU instances or error details.
        """
        GetAvailableGpusSchema(**args)

        try:
            # Get available instances
            response = self.marketplace.get_available_instances()

            if not response.instances:
                return "No available GPU instances found."

            # Format the response
            output = ["Available GPU Options:"]
            
            # Filter out None values that might be returned by format_gpu_instance
            formatted_instances = []
            for instance in response.instances:
                formatted = format_gpu_instance(instance)
                if formatted is not None:
                    formatted_instances.append(formatted)
            
            # Check if we have any available instances after filtering
            if not formatted_instances:
                return "No available GPU instances with free resources found."
            
            # Join the formatted instances with the header
            return "Available GPU Options:\n\n" + "\n".join(formatted_instances)

        except Exception as e:
            return f"Error retrieving available GPUs: {e}"

    @create_action(
        name="get_gpu_status",
        description="""
This tool will get the status and SSH commands for your currently rented GPUs on the Hyperbolic platform.

It does not take any inputs.

A successful response will show details for each rented GPU like:
    Instance ID: i-123456
    Status: running
    GPU Model: NVIDIA A100
    SSH Command: ssh user@host -i key.pem
    ----------------------------------------

A failure response will return an error message like:
    Error retrieving GPU status: API request failed
    Error retrieving GPU status: Invalid authentication credentials

Important notes:
- Authorization key is required for this operation
- If status is "starting", the GPU is not ready yet - check again in a few seconds
- Once status is "running", you can use the SSH command to access the instance
- If no SSH command is shown, the instance is still being provisioned
""",
        schema=GetGpuStatusSchema,
    )
    def get_gpu_status(self, args: dict[str, Any]) -> str:
        """Get status of currently rented GPUs.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the status of rented GPUs or error details.
        """
        GetGpuStatusSchema(**args)

        try:
            # Get rented instances
            response = self.marketplace.get_rented_instances()

            if not response.instances:
                return "No rented GPU instances found."

            # Format the response
            output = ["Your Rented GPU Instances:"]
            for instance in response.instances:
                output.append(format_gpu_status(instance))
                output.append("-" * 40)

            # Add SSH instructions
            output.extend([
                "\nSSH Connection Instructions:",
                "1. Wait until instance status is 'running'",
                "2. Use the ssh_connect action with the provided host and username",
                "3. Once connected, use remote_shell to execute commands",
            ])

            return "\n".join(output)

        except Exception as e:
            return f"Error retrieving GPU status: {e}"

    @create_action(
        name="rent_compute",
        description="""
This tool rents a GPU machine on Hyperbolic platform.

Required inputs:
- cluster_name: Which cluster the node is on
- node_name: Which node to rent
- gpu_count: How many GPUs to rent

Example response:
    {
      "status": "success",
      "instance": {
        "id": "i-123456",
        "cluster": "us-east-1",
        "node": "node-789",
        "gpu_count": 2,
        "status": "starting"
      }
    }

A failure response will return an error message like:
    Error renting compute: Invalid cluster name
    Error renting compute: Node not available

Notes:
- Use get_available_gpus first to get valid cluster and node names
- Do not ask for a duration, it is not needed
- After renting, you can:
  - Check status with get_gpu_status
  - Connect via SSH with ssh_connect
  - Run commands with remote_shell
""",
        schema=RentComputeSchema,
    )
    def rent_compute(self, args: dict[str, Any]) -> str:
        """Rent GPU compute resources from Hyperbolic platform.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - cluster_name: The cluster to rent from
                - node_name: The node ID to rent
                - gpu_count: Number of GPUs to rent

        Returns:
            str: A message containing the rental response or error details.
        """
        validated_args = RentComputeSchema(**args)

        try:
            # Make the rental request
            response = self.marketplace.rent_instance(validated_args)

            # Format the response with next steps
            return format_rent_compute_response(response)

        except Exception as e:
            return f"Error renting compute: {e}"

    @create_action(
        name="terminate_compute",
        description="""
This tool allows you to terminate a GPU instance on the Hyperbolic platform.

Required inputs:
- instance_id: The ID of the instance to terminate (e.g., "respectful-rose-pelican")

Example successful response:
    {
      "status": "success",
      "message": "Instance terminated successfully"
    }

A failure response will return an error message like:
    Error terminating compute: Instance not found
    Error terminating compute: Instance already terminated
    Error terminating compute: API request failed

Important notes:
- The instance ID must be valid and active
- After termination, the instance will no longer be accessible
- You can get instance IDs using get_gpu_status
- Any active SSH connections will be closed
""",
        schema=TerminateComputeSchema,
    )
    def terminate_compute(self, args: dict[str, Any]) -> str:
        """Terminate a GPU compute instance.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - instance_id: The ID of the instance to terminate.

        Returns:
            str: A message containing the termination response or error details.
        """
        validated_args = TerminateComputeSchema(**args)

        try:
            # Make the termination request
            response = self.marketplace.terminate_instance(validated_args)

            # Format the response with next steps
            return format_terminate_compute_response(response)

        except Exception as e:
            return f"Error terminating compute: {e}"

    @create_action(
        name="ssh_connect",
        description="""
This tool will establish an SSH connection to a remote server.

Required inputs:
- host: Hostname or IP address of the remote server
- username: SSH username for authentication

Optional inputs:
- password: SSH password for authentication (if not using key)
- private_key_path: Path to private key file (uses SSH_PRIVATE_KEY_PATH env var if not provided)
- port: SSH port number (default: 22)

Example successful response:
    Successfully connected to host.example.com as username

A failure response will return an error message like:
    SSH Connection Error: Authentication failed
    SSH Connection Error: Connection refused
    SSH Key Error: Key file not found at /path/to/key

Important notes:
- After connecting, use remote_shell to execute commands
- Use 'ssh_status' command to check connection status
- Connection remains active until explicitly disconnected
- Default key path is ~/.ssh/id_rsa if not specified
- Either password or key authentication must be provided
""",
        schema=SSHAccessSchema,
    )
    def ssh_connect(self, args: dict[str, Any]) -> str:
        """Establish SSH connection to remote server.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - host: Remote server hostname/IP
                - username: SSH username
                - password: Optional SSH password
                - private_key_path: Optional key file path
                - port: Optional port number

        Returns:
            str: Connection status message.
        """
        validated_args = SSHAccessSchema(**args)

        try:
            # Check if we have a valid host and username
            if not validated_args.host or not validated_args.username:
                # Try to get instance information to suggest connection details
                try:
                    response = self.marketplace.get_rented_instances()

                    if response.instances:
                        instance_info = []
                        for instance in response.instances:
                            status = instance.status.lower()
                            instance_id = instance.id
                            if instance.ssh_access and status == "running":
                                instance_info.append(
                                    f"Instance {instance_id}: host={instance.ssh_access.host}, username={instance.ssh_access.username}"
                                )

                        if instance_info:
                            return "Missing host or username. Available instances:\n" + "\n".join(
                                instance_info
                            )
                except Exception:
                    pass

                return "Error: Host and username are required for SSH connection."

            # Establish SSH connection
            return ssh_manager.connect(
                host=validated_args.host,
                username=validated_args.username,
                password=validated_args.password,
                private_key_path=validated_args.private_key_path,
                port=validated_args.port,
            )

        except Exception as e:
            return f"SSH Connection Error: {e}"

    @create_action(
        name="remote_shell",
        description="""
This tool will execute shell commands on a remote server via SSH.

Required inputs:
- command: The shell command to execute on the remote server

Example successful response:
    Command output from remote server

A failure response will return an error message like:
    Error: No active SSH connection. Please connect first.
    Error: Command execution failed.
    Error: SSH connection lost.

Important notes:
- Requires an active SSH connection (use ssh_connect first)
- Use 'ssh_status' to check current connection status
- Commands are executed in the connected SSH session
- Returns command output as a string
- You can install any packages you need on the remote server
""",
        schema=RemoteShellSchema,
    )
    def remote_shell(self, args: dict[str, Any]) -> str:
        """Execute a command on the remote server.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - command: The shell command to execute.

        Returns:
            str: Command output or error message.
        """
        validated_args = RemoteShellSchema(**args)
        command = validated_args.command.strip()

        # Special command to check SSH status
        if command.lower() == "ssh_status":
            return ssh_manager.get_connection_info()

        # Verify SSH is connected before executing
        if not ssh_manager.is_connected:
            # Try to get instance information to suggest connection details
            try:
                response = self.marketplace.get_rented_instances()

                if response.instances:
                    instance_info = []
                    for instance in response.instances:
                        status = instance.status.lower()
                        instance_id = instance.id
                        if instance.ssh_access and status == "running":
                            instance_info.append(
                                f"Instance {instance_id}: host={instance.ssh_access.host}, username={instance.ssh_access.username}"
                            )

                    if instance_info:
                        return (
                            "Error: No active SSH connection. Please connect first using ssh_connect.\n\nAvailable instances:\n"
                            + "\n".join(instance_info)
                        )
            except Exception:
                pass

            return "Error: No active SSH connection. Please connect to a remote server first using ssh_connect."

        try:
            # Execute command remotely
            return ssh_manager.execute(command)
        except Exception as e:
            return f"Error executing remote command: {e}"

    def supports_network(self, _: Network) -> bool:
        """Check if network is supported by Hyperbolic marketplace actions.

        Args:
            _ (Network): The network to check support for.

        Returns:
            bool: Always True as Hyperbolic marketplace actions don't depend on blockchain networks.
        """
        return True


def hyperbolic_marketplace_action_provider(
    api_key: str | None = None,
) -> MarketplaceActionProvider:
    """Create and return a new HyperbolicMarketplaceActionProvider instance.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        HyperbolicMarketplaceActionProvider: A new instance of the Hyperbolic marketplace action provider.

    Raises:
        ValueError: If API key is not provided and not found in environment.
    """
    return MarketplaceActionProvider(api_key=api_key) 