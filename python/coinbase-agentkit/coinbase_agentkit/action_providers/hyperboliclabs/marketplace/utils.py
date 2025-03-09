"""Utility functions for Hyperbolic Marketplace action provider."""

import contextlib
import json
import os
from datetime import datetime
from typing import Any, Union

import paramiko
import requests

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
            default_key_path = os.getenv("SSH_PRIVATE_KEY_PATH", "~/.ssh/id_rsa")
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


def format_gpu_status(instance: NodeRental) -> str:
    """Format a rented GPU instance status into a readable string.

    Args:
        instance: NodeRental object containing instance details.

    Returns:
        str: Formatted status string.

    """
    instance_id = instance.id
    status = instance.status
    status_detail = ""  # This may not be available in the model

    # Get GPU information
    gpus = instance.instance.hardware.gpus

    # Extract GPU model from the first GPU
    gpu_model = "Unknown Model"
    if gpus:
        gpu_model = gpus[0].model

    # Get GPU count
    gpu_count = instance.instance.gpu_count or (len(gpus) if gpus else 1)

    # Get GPU memory if available
    gpu_memory = None
    if gpus and gpus[0].ram:
        gpu_memory = f"{gpus[0].ram} GB"

    # Get SSH access details if available
    ssh_command = instance.ssh_command

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
        output.append(f"SSH Command: {ssh_command}")
    elif instance.ssh_access:
        # If we have SSH access details but no command, construct one
        key_path = instance.ssh_access.key_path or "~/.ssh/id_rsa"
        output.append(f"SSH Command: ssh {instance.ssh_access.username}@{instance.ssh_access.host} -i {key_path}")
    else:
        # This part requires extracting host and username from SSH command or other fields
        # For now, just provide guidance based on status
        if status.lower() in ["running", "online"]:
            output.append(
                "SSH Command: Not available yet. Instance is running but SSH details are not provided."
            )
            output.append(
                "Try again in a few seconds or check the Hyperbolic dashboard for SSH details."
            )
        else:
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

    return "\n".join(output)


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
