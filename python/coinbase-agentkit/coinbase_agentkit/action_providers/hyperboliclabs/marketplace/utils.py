"""Utility functions for Hyperbolic Marketplace action provider."""

import contextlib
import os
from datetime import datetime
import logging

import paramiko

from .models import (
    AvailableInstance,
    NodeRental,
    RentInstanceResponse,
    TerminateInstanceResponse,
)


class SSHManager:
    """Manages SSH connections to remote servers.

    This is a singleton class that maintains a single SSH connection at a time.
    It provides methods for connecting, executing commands, and managing the connection state.
    """

    _instance = None
    _ssh_client = None
    _connected = False
    _host = None
    _username = None
    _last_error = None
    _connection_time = None

    def __new__(cls):
        """Create or return the singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_connected(self) -> bool:
        """Check if there's an active SSH connection."""
        if self._ssh_client and self._connected:
            try:
                # Use a simple command to test connection
                stdin, stdout, stderr = self._ssh_client.exec_command("echo 1", timeout=5)
                result = stdout.read().decode().strip()
                if result == "1":
                    return True
            except Exception as e:
                self._connected = False
                self._last_error = str(e)
        return False

    def connect(
        self,
        host: str,
        username: str,
        password: str | None = None,
        private_key_path: str | None = None,
        port: int = 22,
    ) -> str:
        """Establish SSH connection.

        Args:
            host: Remote server hostname/IP
            username: SSH username
            password: Optional SSH password
            private_key_path: Optional path to private key file
            port: SSH port number (default: 22)

        Returns:
            str: Connection status message

        """
        try:
            # Close existing connection if any
            self.disconnect()

            # Initialize new client
            self._ssh_client = paramiko.SSHClient()
            self._ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # Get default key path from environment
            default_key_path = os.getenv("HYPERBOLIC_SSH_PRIVATE_KEY_PATH", "~/.ssh/id_rsa")
            default_key_path = os.path.expanduser(default_key_path)

            connection_details = f"Connecting to {host}:{port} as {username}"
            if password:
                connection_details += " using password authentication"
                self._ssh_client.connect(
                    host, port=port, username=username, password=password, timeout=10
                )
            else:
                key_path = private_key_path if private_key_path else default_key_path
                connection_details += f" using key at {key_path}"

                if not os.path.exists(key_path):
                    self._last_error = f"Key file not found at {key_path}"
                    return f"SSH Key Error: {self._last_error}"

                try:
                    private_key = paramiko.RSAKey.from_private_key_file(key_path)
                except Exception as e:
                    self._last_error = f"Failed to load key: {e!s}"
                    return f"SSH Key Error: {self._last_error}"

                self._ssh_client.connect(
                    host, port=port, username=username, pkey=private_key, timeout=10
                )

            # Test connection with a simple command
            stdin, stdout, stderr = self._ssh_client.exec_command(
                'echo "Connection successful"', timeout=5
            )
            result = stdout.read().decode().strip()

            if result != "Connection successful":
                error = stderr.read().decode().strip()
                self._last_error = f"Connection test failed: {error}"
                self._connected = False
                return f"SSH Connection Error: {self._last_error}"

            self._connected = True
            self._host = host
            self._username = username
            self._connection_time = datetime.now()
            self._last_error = None

            return f"Successfully connected to {host} as {username}"

        except Exception as e:
            self._connected = False
            self._last_error = str(e)
            return f"SSH Connection Error: {e!s}"

    def execute(self, command: str) -> str:
        """Execute command on connected server.

        Args:
            command: Shell command to execute

        Returns:
            str: Command output or error message

        """
        if not self.is_connected:
            return f"Error: No active SSH connection. Please connect first. Last error: {self._last_error or 'None'}"

        try:
            stdin, stdout, stderr = self._ssh_client.exec_command(command, timeout=30)
            output = stdout.read().decode()
            error = stderr.read().decode()

            if error:
                return f"Error: {error}\nOutput: {output}"
            return output

        except Exception as e:
            self._connected = False
            self._last_error = str(e)
            return f"SSH Command Error: {e!s}"

    def disconnect(self):
        """Close SSH connection."""
        if self._ssh_client:
            with contextlib.suppress(Exception):
                self._ssh_client.close()
        self._connected = False
        self._host = None
        self._username = None

    def get_connection_info(self) -> str:
        """Get current connection information.

        Returns:
            str: Connection status message

        """
        if self.is_connected:
            connection_time = (
                self._connection_time.strftime("%Y-%m-%d %H:%M:%S")
                if self._connection_time
                else "Unknown"
            )
            return f"Connected to {self._host} as {self._username} since {connection_time}"

        if self._last_error:
            return f"Not connected. Last error: {self._last_error}"

        return "Not connected"


# Global instance
ssh_manager = SSHManager()


def get_api_key() -> str:
    """Get Hyperbolic API key from environment variables.

    Returns:
        str: The API key.

    Raises:
        ValueError: If API key is not configured.

    """
    api_key = os.getenv("HYPERBOLIC_API_KEY")
    if not api_key:
        raise ValueError("HYPERBOLIC_API_KEY is not configured.")
    return api_key


def format_gpu_instance(instance: AvailableInstance) -> str | None:
    """Format a single GPU instance into a readable string.

    Args:
        instance: AvailableInstance object containing instance details.

    Returns:
        str | None: Formatted string if instance has available GPUs, None otherwise.

    """
    # Skip if reserved
    if instance.reserved:
        return None

    cluster_name = instance.cluster_name or "Unknown Cluster"
    node_id = instance.id

    # Get GPU information
    gpus = instance.hardware.gpus
    gpu_model = gpus[0].model if gpus else "Unknown Model"

    # Get pricing (convert cents to dollars)
    price_amount = instance.pricing.price.amount / 100 if instance.pricing else 0

    # Get GPU availability
    gpus_total = instance.gpus_total or 0
    gpus_reserved = instance.gpus_reserved or 0
    gpus_available = gpus_total - gpus_reserved

    if gpus_available <= 0:
        return None

    return (
        f"Cluster: {cluster_name}\n"
        f"Node ID: {node_id}\n"
        f"GPU Model: {gpu_model}\n"
        f"Available GPUs: {gpus_available}/{gpus_total}\n"
        f"Price: ${price_amount:.2f}/hour per GPU\n"
        f"{'-' * 40}\n\n"
    )


def format_gpu_types(instances: list[AvailableInstance]) -> str:
    """Format a list of available GPU types/models.

    Args:
        instances: List of AvailableInstance objects.

    Returns:
        str: Formatted string with available GPU types.
    """
    # Extract and collect all available GPU models
    gpu_models = set()
    
    for instance in instances:
        # Skip if reserved or no available GPUs
        if instance.reserved:
            continue
        
        gpus_total = instance.gpus_total or 0
        gpus_reserved = instance.gpus_reserved or 0
        gpus_available = gpus_total - gpus_reserved
        
        if gpus_available <= 0:
            continue
        
        # Get GPU model information
        gpus = instance.hardware.gpus
        if gpus:
            gpu_models.add(gpus[0].model)

    # Check if we have any available GPU models
    if not gpu_models:
        return "No available GPU types found."

    # Format the response
    gpu_models_list = sorted(list(gpu_models))
    formatted_models = "\n".join([f"- {model}" for model in gpu_models_list])
    return f"Available GPU Types:\n{formatted_models}"


def format_gpu_instances_by_type(instances: list[AvailableInstance], gpu_model: str) -> str:
    """Format a list of available GPU instances of a specific model.

    Args:
        instances: List of AvailableInstance objects.
        gpu_model: The specific GPU model to filter by.

    Returns:
        str: Formatted string with available GPU instances of the specified model.
    """
    # Filter and format instances by GPU model
    formatted_instances = []
    
    for instance in instances:
        # Skip if reserved
        if instance.reserved:
            continue
        
        # Get GPU information
        gpus = instance.hardware.gpus
        instance_gpu_model = gpus[0].model if gpus else "Unknown Model"
        
        # Skip if not matching the requested model
        if instance_gpu_model != gpu_model:
            continue
        
        # Get GPU availability
        gpus_total = instance.gpus_total or 0
        gpus_reserved = instance.gpus_reserved or 0
        gpus_available = gpus_total - gpus_reserved
        
        if gpus_available <= 0:
            continue
        
        formatted = format_gpu_instance(instance)
        if formatted is not None:
            formatted_instances.append(formatted)

    # Check if we have any matching instances
    if not formatted_instances:
        return f"No available GPU instances with the model '{gpu_model}' found."

    # Join the formatted instances with the header
    return f"Available {gpu_model} GPU Options:\n\n" + "\n".join(formatted_instances)


def format_all_gpu_instances(instances: list[AvailableInstance]) -> str:
    """Format a list of all available GPU instances.

    Args:
        instances: List of AvailableInstance objects.

    Returns:
        str: Formatted string with all available GPU instances.
    """
    # Format all available instances
    formatted_instances = []
    
    for instance in instances:
        formatted = format_gpu_instance(instance)
        if formatted is not None:
            formatted_instances.append(formatted)

    # Check if we have any available instances after filtering
    if not formatted_instances:
        return "No available GPU instances with free resources found."

    # Join the formatted instances with the header
    return "Available GPU Options:\n\n" + "\n".join(formatted_instances)


def format_gpu_status(instance: NodeRental) -> str:
    """Format a rented GPU instance status into a readable string.

    Args:
        instance: NodeRental object containing instance details.

    Returns:
        str: Formatted status string.

    """
    logging.info(f"Formatting GPU status for instance: {instance.id}")
    instance_id = instance.id
    status = instance.status
    status_detail = ""  # This may not be available in the model

    # Get GPU information
    gpus = instance.instance.hardware.gpus
    logging.info(f"GPUs: {gpus}")

    # Extract GPU model from the first GPU
    gpu_model = "Unknown Model"
    if gpus:
        gpu_model = gpus[0].model
    logging.info(f"GPU Model: {gpu_model}")

    # Get GPU count
    gpu_count = instance.instance.gpu_count or (len(gpus) if gpus else 1)
    logging.info(f"GPU Count: {gpu_count}")

    # Get GPU memory if available
    gpu_memory = None
    if gpus and gpus[0].ram:
        # Convert from MB to GB by dividing by 1024
        ram_gb = gpus[0].ram / 1024
        gpu_memory = f"{ram_gb:.1f} GB"
    logging.info(f"GPU Memory: {gpu_memory}")

    # Get SSH access details if available
    ssh_command = instance.ssh_command
    logging.info(f"SSH Command from instance: {ssh_command}")
    
    if instance.ssh_access:
        logging.info(f"SSH Access details: host={instance.ssh_access.host}, username={instance.ssh_access.username}, keypath={instance.ssh_access.key_path}")
    else:
        logging.info("No SSH Access details available")

    # Format the output
    output = [f"Instance ID: {instance_id}"]

    # Add status with more descriptive information
    if status.lower() == "running":
        output.append(f"Status: {status} (Ready to use)")
    elif status.lower() == "starting":
        output.append(f"Status: {status} (Still initializing)")
    elif status.lower() == "terminated":
        output.append(f"Status: {status} (No longer available)")
    elif status.lower() == "unknown":
        output.append(f"Status: {status} (Instance is still being provisioned)")
    elif status.lower() == "online":
        output.append("Status: running (Ready to use)")
    else:
        output.append(f"Status: {status}")
    
    logging.info(f"Formatted status: {output[-1]}")

    # Add status detail if available
    if status_detail:
        output.append(f"Status Detail: {status_detail}")

    # Add GPU information
    output.append(f"GPU Model: {gpu_model}")
    if gpu_count > 0:
        output.append(f"GPU Count: {gpu_count}")
    if gpu_memory:
        output.append(f"GPU Memory: {gpu_memory}")

    # Add SSH information based on what's available
    if ssh_command:
        logging.info(f"Using provided SSH command: {ssh_command}")
        output.append(f"SSH Command: {ssh_command}")
    elif instance.ssh_access:
        # If we have SSH access details but no command, construct one
        key_path = instance.ssh_access.key_path or "~/.ssh/id_rsa"
        constructed_ssh_cmd = f"ssh {instance.ssh_access.username}@{instance.ssh_access.host} -i {key_path}"
        logging.info(f"Constructed SSH command: {constructed_ssh_cmd}")
        output.append(f"SSH Command: {constructed_ssh_cmd}")
    else:
        # This part requires extracting host and username from SSH command or other fields
        # For now, just provide guidance based on status
        if status.lower() in ["running", "online"]:
            logging.info("Instance is running but SSH details are missing")
            output.append(
                "SSH Command: Not available yet. Instance is running but SSH details are not provided."
            )
            output.append(
                "Try again in a few seconds or check the Hyperbolic dashboard for SSH details."
            )
        else:
            logging.info(f"Instance not ready for SSH. Status: {status}")
            output.append("SSH Command: Not available yet. Instance is still being provisioned.")

            # Add more specific guidance based on status
            if status.lower() == "starting":
                output.append("The instance is starting up. Please check again in a few seconds.")
            elif status.lower() == "unknown":
                output.append(
                    "The instance status is unknown. Please check again in 30-60 seconds."
                )
            else:
                output.append(f"Current status: {status}. Check again when status is 'running'.")

    output.append("-" * 40)
    output.append("")
    
    result = "\n".join(output)
    logging.info(f"Final formatted output:\n{result}")
    
    return result


def format_rent_compute_response(response_data: RentInstanceResponse) -> str:
    """Format compute rental response into a readable string.

    Args:
        response_data: RentInstanceResponse object from compute rental API.

    Returns:
        str: Formatted response string with next steps.

    """
    # Format the API response
    formatted_response = response_data.model_dump_json(indent=2)

    # Add next steps information
    next_steps = (
        "\nNext Steps:\n"
        "1. Your GPU instance is being provisioned\n"
        "2. Use get_gpu_status to check when it's ready\n"
        "3. Once status is 'running', you can:\n"
        "   - Connect via SSH using the provided command\n"
        "   - Run commands using remote_shell\n"
        "   - Install packages and set up your environment"
    )

    return f"{formatted_response}\n{next_steps}"


def format_terminate_compute_response(response_data: TerminateInstanceResponse) -> str:
    """Format compute termination response into a readable string.

    Args:
        response_data: TerminateInstanceResponse object from compute termination API.

    Returns:
        str: Formatted response string with next steps.

    """
    # Log the response data being formatted
    logging.info(f"Formatting terminate compute response: {response_data.model_dump()}")
    
    # If this is an error response, just return a simple message without next steps
    if response_data.error_code is not None or (response_data.status and response_data.status.lower() != "success"):
        error_msg = f"Error terminating compute: {response_data.message}"
        logging.warning(f"Termination error: {error_msg}")
        return error_msg
    
    # Format the API response
    formatted_response = response_data.model_dump_json(indent=2)

    # Add next steps information
    next_steps = (
        "\nNext Steps:\n"
        "1. Your GPU instance has been terminated\n"
        "2. Any active SSH connections have been closed\n"
        "3. You can check your spend history with get_spend_history\n"
        "4. To rent a new instance, use get_available_gpus and rent_compute"
    )

    return f"{formatted_response}\n{next_steps}"
