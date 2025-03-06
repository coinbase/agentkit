"""Hyperbolic action provider.

This module provides actions for interacting with the Hyperbolic platform for GPU compute resources.
It includes functionality for managing GPU instances, SSH access, and billing operations.
"""

from typing import Any

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    GetAvailableGpusSchema,
    GetCurrentBalanceSchema,
    GetGpuStatusSchema,
    GetSpendHistorySchema,
    LinkWalletAddressSchema,
    RemoteShellSchema,
    RentComputeSchema,
    SSHAccessSchema,
    TerminateComputeSchema,
)
from .utils import (
    format_gpu_instance,
    format_gpu_status,
    format_purchase_history,
    format_rent_compute_response,
    format_spend_history,
    format_terminate_compute_response,
    format_wallet_link_response,
    get_api_key,
    get_balance_info,
    make_api_request,
    ssh_manager,
)


class HyperbolicActionProvider(ActionProvider):
    """Provides actions for interacting with Hyperbolic platform.

    This provider enables interaction with the Hyperbolic platform for GPU compute resources.
    It requires an API key which can be provided directly or through the HYPERBOLIC_API_KEY
    environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic action provider.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        super().__init__("hyperbolic", [])

        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

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
        """Get available GPUs from Hyperbolic platform.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the formatted list of available GPUs or error details.

        """
        GetAvailableGpusSchema(**args)

        try:
            data = make_api_request(
                api_key=self.api_key, endpoint="marketplace", data={"filters": {}}
            )

            if "instances" not in data:
                return "No available GPU instances found."

            formatted_output = "Available GPU Options:\n\n"

            if "instances" in data:
                for instance in data["instances"]:
                    formatted_instance = format_gpu_instance(instance)
                    if formatted_instance:
                        formatted_output += formatted_instance

            if formatted_output == "Available GPU Options:\n\n":
                return "No available GPU instances found."

            return formatted_output

        except Exception as e:
            return f"Error retrieving available GPUs: {e}"

    @create_action(
        name="get_current_balance",
        description="""
This tool retrieves your current Hyperbolic platform credit balance.

It does not take any inputs.

A successful response will show:
- Available Hyperbolic platform credits in your account (in USD)
- Recent credit purchase history with dates and amounts

Example successful response:
    Your current Hyperbolic platform balance is $150.00.
    Purchase History:
    - $100.00 on January 15, 2024
    - $50.00 on December 30, 2023

A failure response will return an error message like:
    Error retrieving balance information: API request failed
    Error retrieving balance information: Invalid authentication credentials

Important notes:
- Authorization key is required for this operation
- This shows platform credits only, NOT cryptocurrency wallet balances
- All amounts are shown in USD
- Purchase history is ordered from most recent to oldest
""",
        schema=GetCurrentBalanceSchema,
    )
    def get_current_balance(self, args: dict[str, Any]) -> str:
        """Get current balance and purchase history from the account.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the current balance and purchase history or error details.

        """
        GetCurrentBalanceSchema(**args)

        try:
            # Get balance info
            data = get_balance_info(self.api_key)

            # Format the response
            balance_usd = data["balance"] / 100  # Convert cents to dollars
            output = [f"Your current Hyperbolic platform balance is ${balance_usd:.2f}."]

            # Add purchase history
            output.append(format_purchase_history(data["purchase_history"]))

            return "\n".join(output)

        except Exception as e:
            return f"Error retrieving balance information: {e}"

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
            # Get instances data
            data = make_api_request(
                api_key=self.api_key, endpoint="marketplace/instances", method="GET"
            )

            # Check if the response has the expected structure
            if not isinstance(data, dict):
                return f"Error: Unexpected API response format: {data}"

            # Format the response
            if not data.get("instances"):
                return "No rented GPU instances found."

            if not isinstance(data["instances"], list):
                return f"Error: Unexpected instances format: {data['instances']}"

            output = ["Your Rented GPU Instances:\n"]
            for instance_data in data["instances"]:
                try:
                    # Extract the instance ID
                    instance_id = instance_data.get("id", "Unknown ID")

                    # Extract SSH command if available
                    ssh_command = instance_data.get("sshCommand", "")

                    # Get the nested instance object which contains detailed information
                    instance = instance_data.get("instance", {})
                    if not instance:
                        instance = instance_data  # Fallback to the top-level object

                    # Extract status
                    status = instance.get("status", "Unknown")

                    # Create a more complete instance object with all available information
                    complete_instance = {
                        "id": instance_id,
                        "status": status,
                        "hardware": {"gpus": []},
                        "ssh_access": {"ssh_command": ssh_command},
                    }

                    # Extract GPU information if available
                    if "hardware" in instance and "gpus" in instance["hardware"]:
                        complete_instance["hardware"] = instance["hardware"]

                    # Extract GPU count if available
                    gpu_count = instance.get("gpu_count", 1)  # Default to 1 if not specified
                    complete_instance["gpu_count"] = gpu_count

                    # Add status detail based on the status
                    if status.lower() == "online" or status.lower() == "running":
                        complete_instance["status"] = "running"
                        complete_instance["status_detail"] = "Instance is running and ready to use."
                    elif status.lower() == "starting" or status.lower() == "provisioning":
                        complete_instance["status_detail"] = (
                            "Instance is starting up. Please check again in a few seconds."
                        )
                    elif status.lower() == "terminated" or status.lower() == "offline":
                        complete_instance["status_detail"] = "Instance has been terminated."
                    else:
                        complete_instance["status_detail"] = (
                            "Instance is still being provisioned. Please check again later."
                        )

                    # Format the instance information
                    output.append(format_gpu_status(complete_instance))
                except Exception as e:
                    output.append(f"Error formatting instance: {e}")
                    output.append(f"Raw instance data: {instance_data}")
                    output.append("-" * 40)
                    output.append("")

            # Add helpful information about SSH connection
            output.append("SSH Connection Instructions:")
            output.append("1. Wait until instance status is 'running'")
            output.append("2. Use the ssh_connect action with the host and username provided")
            output.append("3. If no SSH details are shown, try again in a few seconds")
            output.append("4. After connecting, use remote_shell to execute commands")

            return "\n".join(output)

        except Exception as e:
            return f"Error retrieving GPU status: {e}"

    @create_action(
        name="get_spend_history",
        description="""
This tool retrieves your GPU rental spending history from Hyperbolic platform.

It does not take any inputs.

A successful response will show:
- List of instances rented with details (GPU model, count, duration, cost)
- Statistics per GPU type (rentals, time, cost)
- Overall total spending

Example response:
    === GPU Rental Spending Analysis ===

    Instance Rentals:
    - instance-123:
      GPU: NVIDIA A100 (Count: 2)
      Duration: 3600 seconds
      Cost: $25.00

    GPU Type Statistics:
    NVIDIA A100:
      Total Rentals: 2
      Total Time: 3600 seconds
      Total Cost: $25.00

    Total Spending: $25.00

A failure response will return an error message like:
    Error retrieving spend history: API request failed

Notes:
- Authorization key is required
- All costs are in USD
- Duration is in seconds
- History includes all past rentals
""",
        schema=GetSpendHistorySchema,
    )
    def get_spend_history(self, args: dict[str, Any]) -> str:
        """Get and analyze GPU rental spending history.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the spending analysis or error details.

        """
        GetSpendHistorySchema(**args)

        try:
            # Get instance history data
            data = make_api_request(
                api_key=self.api_key, endpoint="marketplace/instances/history", method="GET"
            )

            # Format and analyze the response
            return format_spend_history(data.get("instance_history", []))

        except Exception as e:
            return f"Error retrieving spend history: {e}"

    @create_action(
        name="link_wallet_address",
        description="""
This tool links a wallet address to your Hyperbolic account.

Required inputs:
- wallet_address: The wallet address to link to your Hyperbolic account

Example successful response:
    {
      "status": "success",
      "message": "Wallet address linked successfully"
    }

    Next Steps:
    1. Your wallet has been successfully linked
    2. To add funds, send any of these tokens on Base network:
       - USDC
       - USDT
       - DAI
    3. Send to this Hyperbolic address: 0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60

A failure response will return an error message like:
    Error linking wallet address: Invalid wallet address format
    Error linking wallet address: API request failed

Notes:
- Authorization key is required
- The wallet address must be a valid Ethereum address
- After linking, you can send USDC, USDT, or DAI on Base network
""",
        schema=LinkWalletAddressSchema,
    )
    def link_wallet_address(self, args: dict[str, Any]) -> str:
        """Link a wallet address to your Hyperbolic account.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - wallet_address: The wallet address to link.

        Returns:
            str: A message containing the linking response and next steps.

        """
        validated_args = LinkWalletAddressSchema(**args)

        try:
            # Link the wallet address
            response_data = make_api_request(
                api_key=self.api_key,
                endpoint="settings/crypto-address",
                data={"address": validated_args.wallet_address},
            )

            # Format the response with next steps
            return format_wallet_link_response(response_data)

        except Exception as e:
            return f"Error linking wallet address: {e}"

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
                data = make_api_request(
                    api_key=self.api_key, endpoint="marketplace/instances", method="GET"
                )

                if data.get("instances"):
                    instance_info = []
                    for instance in data["instances"]:
                        status = instance.get("status", "Unknown")
                        instance_id = instance.get("id", "Unknown")
                        ssh_access = instance.get("ssh_access", {})
                        ssh_host = ssh_access.get("host", "")
                        ssh_username = ssh_access.get("username", "")

                        if ssh_host and ssh_username and status.lower() == "running":
                            instance_info.append(
                                f"Instance {instance_id}: host={ssh_host}, username={ssh_username}"
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
            response_data = make_api_request(
                api_key=self.api_key,
                endpoint="marketplace/instances/create",
                data={
                    "cluster_name": validated_args.cluster_name,
                    "node_name": validated_args.node_name,
                    "gpu_count": validated_args.gpu_count,
                },
            )

            # Format the response with next steps
            return format_rent_compute_response(response_data)

        except Exception as e:
            return f"Error renting compute: {e}"

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
                    data = make_api_request(
                        api_key=self.api_key, endpoint="marketplace/instances", method="GET"
                    )

                    if data.get("instances"):
                        instance_info = []
                        for instance in data["instances"]:
                            status = instance.get("status", "Unknown")
                            instance_id = instance.get("id", "Unknown")
                            ssh_access = instance.get("ssh_access", {})
                            ssh_host = ssh_access.get("host", "")
                            ssh_username = ssh_access.get("username", "")

                            if ssh_host and ssh_username and status.lower() == "running":
                                instance_info.append(
                                    f"Instance {instance_id}: host={ssh_host}, username={ssh_username}"
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
            response_data = make_api_request(
                api_key=self.api_key,
                endpoint="marketplace/instances/terminate",
                data={"id": validated_args.instance_id},
            )

            # Format the response with next steps
            return format_terminate_compute_response(response_data)

        except Exception as e:
            return f"Error terminating compute: {e}"

    def supports_network(self, _: Network) -> bool:
        """Check if network is supported by Hyperbolic actions.

        Args:
            _ (Network): The network to check support for.

        Returns:
            bool: Always True as Hyperbolic actions don't depend on blockchain networks.

        """
        return True


def hyperbolic_action_provider(
    api_key: str | None = None,
) -> HyperbolicActionProvider:
    """Create and return a new HyperbolicActionProvider instance.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        HyperbolicActionProvider: A new instance of the Hyperbolic action provider.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return HyperbolicActionProvider(api_key=api_key)
