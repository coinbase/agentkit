"""Utility functions for Hyperbolic action provider."""

import os
import json
import requests
import paramiko
from datetime import datetime
from collections import defaultdict
from typing import Any, Dict, List, Optional


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
            cls._instance = super(SSHManager, cls).__new__(cls)
        return cls._instance

    @property
    def is_connected(self) -> bool:
        """Check if there's an active SSH connection."""
        if self._ssh_client and self._connected:
            try:
                # Use a simple command to test connection
                stdin, stdout, stderr = self._ssh_client.exec_command('echo 1', timeout=5)
                result = stdout.read().decode().strip()
                if result == "1":
                    return True
            except Exception as e:
                self._connected = False
                self._last_error = str(e)
        return False

    def connect(self, host: str, username: str, password: Optional[str] = None, 
                private_key_path: Optional[str] = None, port: int = 22) -> str:
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
            default_key_path = os.getenv('SSH_PRIVATE_KEY_PATH', '~/.ssh/id_rsa')
            default_key_path = os.path.expanduser(default_key_path)

            connection_details = f"Connecting to {host}:{port} as {username}"
            if password:
                connection_details += " using password authentication"
                self._ssh_client.connect(host, port=port, username=username, password=password, timeout=10)
            else:
                key_path = private_key_path if private_key_path else default_key_path
                connection_details += f" using key at {key_path}"
                
                if not os.path.exists(key_path):
                    self._last_error = f"Key file not found at {key_path}"
                    return f"SSH Key Error: {self._last_error}"
                
                try:
                    private_key = paramiko.RSAKey.from_private_key_file(key_path)
                except Exception as e:
                    self._last_error = f"Failed to load key: {str(e)}"
                    return f"SSH Key Error: {self._last_error}"
                
                self._ssh_client.connect(host, port=port, username=username, pkey=private_key, timeout=10)

            # Test connection with a simple command
            stdin, stdout, stderr = self._ssh_client.exec_command('echo "Connection successful"', timeout=5)
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
            return f"SSH Connection Error: {str(e)}"

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
            return f"SSH Command Error: {str(e)}"

    def disconnect(self):
        """Close SSH connection."""
        if self._ssh_client:
            try:
                self._ssh_client.close()
            except:
                pass
        self._connected = False
        self._host = None
        self._username = None

    def get_connection_info(self) -> str:
        """Get current connection information.
        
        Returns:
            str: Connection status message
        """
        if self.is_connected:
            connection_time = self._connection_time.strftime("%Y-%m-%d %H:%M:%S") if self._connection_time else "Unknown"
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


def format_gpu_instance(instance: Dict[str, Any]) -> str | None:
    """Format a single GPU instance into a readable string.

    Args:
        instance: Dictionary containing instance details.

    Returns:
        str | None: Formatted string if instance has available GPUs, None otherwise.
    """
    # Skip if reserved
    if instance.get("reserved", True):
        return None
        
    cluster_name = instance.get("cluster_name", "Unknown Cluster")
    node_id = instance.get("id", "Unknown Node")
    
    # Get GPU information
    gpus = instance.get("hardware", {}).get("gpus", [])
    gpu_model = gpus[0].get("model", "Unknown Model") if gpus else "Unknown Model"
    
    # Get pricing (convert cents to dollars)
    price_amount = instance.get("pricing", {}).get("price", {}).get("amount", 0) / 100
    
    # Get GPU availability
    gpus_total = instance.get("gpus_total", 0)
    gpus_reserved = instance.get("gpus_reserved", 0)
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


def format_gpu_status(instance: Dict[str, Any]) -> str:
    """Format a rented GPU instance status into a readable string.

    Args:
        instance: Dictionary containing instance details.

    Returns:
        str: Formatted status string.
    """
    instance_id = instance.get("id", "Unknown ID")
    status = instance.get("status", "Unknown")
    status_detail = instance.get("status_detail", "")
    
    # Get GPU information
    gpus = instance.get("hardware", {}).get("gpus", [])
    
    # Extract GPU model from the first GPU
    gpu_model = "Unknown Model"
    if gpus:
        # Try to get the model directly
        if "model" in gpus[0]:
            gpu_model = gpus[0]["model"]
        # Handle alternative format where model might be nested
        elif "gpu_type" in gpus[0]:
            gpu_model = gpus[0]["gpu_type"]
    
    # Get GPU count
    gpu_count = instance.get("gpu_count", len(gpus) if gpus else 1)
    
    # Get GPU memory if available
    gpu_memory = None
    if gpus:
        # Try different possible memory field names
        for memory_field in ["ram", "memory", "vram"]:
            if memory_field in gpus[0]:
                memory_value = gpus[0][memory_field]
                if isinstance(memory_value, dict) and "amount" in memory_value:
                    gpu_memory = f"{memory_value['amount']} {memory_value.get('unit', 'GB')}"
                else:
                    gpu_memory = f"{memory_value} MB"
                break
    
    # Get SSH access details if available
    ssh_access = instance.get("ssh_access", {})
    ssh_command = ssh_access.get("ssh_command", "")
    
    # Get IP address and username if available
    ssh_host = ssh_access.get("host", "")
    ssh_username = ssh_access.get("username", "")
    ssh_key_path = ssh_access.get("key_path", "~/.ssh/id_rsa")
    
    # Format the output
    output = [
        f"Instance ID: {instance_id}"
    ]
    
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
        output.append(f"Status: running (Ready to use)")
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
    elif ssh_host and ssh_username:
        output.append(f"SSH Host: {ssh_host}")
        output.append(f"SSH Username: {ssh_username}")
        output.append(f"SSH Key Path: {ssh_key_path}")
        output.append(f"Connect with: ssh_connect with host={ssh_host}, username={ssh_username}")
    else:
        if status.lower() in ["running", "online"]:
            output.append("SSH Command: Not available yet. Instance is running but SSH details are not provided.")
            output.append("Try again in a few seconds or check the Hyperbolic dashboard for SSH details.")
        else:
            output.append("SSH Command: Not available yet. Instance is still being provisioned.")
            
            # Add more specific guidance based on status
            if status.lower() == "starting":
                output.append("The instance is starting up. Please check again in a few seconds.")
            elif status.lower() == "unknown":
                output.append("The instance status is unknown. Please check again in 30-60 seconds.")
            else:
                output.append(f"Current status: {status}. Check again when status is 'running'.")
    
    output.append("-" * 40)
    output.append("")
    
    return "\n".join(output)


def calculate_duration_seconds(start_time: str, end_time: str) -> float:
    """Calculate duration in seconds between two timestamps.

    Args:
        start_time: ISO format timestamp string.
        end_time: ISO format timestamp string.

    Returns:
        float: Duration in seconds.
    """
    start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    duration = end - start
    return duration.total_seconds()


def format_spend_history(instance_history: List[Dict[str, Any]]) -> str:
    """Format spend history into a readable analysis.

    Args:
        instance_history: List of instance rental records.

    Returns:
        str: Formatted analysis string.
    """
    if not instance_history:
        return "No rental history found."

    # Initialize analysis variables
    total_cost = 0
    gpu_stats = defaultdict(lambda: {"count": 0, "total_cost": 0, "total_seconds": 0})
    instances_summary = []

    # Analyze each instance
    for instance in instance_history:
        duration_seconds = calculate_duration_seconds(
            instance["started_at"], 
            instance["terminated_at"]
        )
        # Convert seconds to hours for cost calculation
        duration_hours = duration_seconds / 3600.0
        # Calculate cost: (hours) * (cents/hour) / (100 cents/dollar)
        cost = (duration_hours * instance["price"]["amount"]) / 100.0
        total_cost += cost

        # Get GPU model and count
        gpus = instance["hardware"].get("gpus", [])
        gpu_model = gpus[0].get("model", "Unknown GPU") if gpus else "Unknown GPU"
        gpu_count = instance["gpu_count"]

        # Update GPU stats
        gpu_stats[gpu_model]["count"] += gpu_count
        gpu_stats[gpu_model]["total_cost"] += cost
        gpu_stats[gpu_model]["total_seconds"] += duration_seconds

        # Create instance summary
        instances_summary.append({
            "name": instance["instance_name"],
            "gpu_model": gpu_model,
            "gpu_count": gpu_count,
            "duration_seconds": int(duration_seconds),
            "cost": round(cost, 2)
        })

    # Format the output
    output = ["=== GPU Rental Spending Analysis ===\n"]

    output.append("Instance Rentals:")
    for instance in instances_summary:
        output.append(f"- {instance['name']}:")
        output.append(f"  GPU: {instance['gpu_model']} (Count: {instance['gpu_count']})")
        output.append(f"  Duration: {instance['duration_seconds']} seconds")
        output.append(f"  Cost: ${instance['cost']:.2f}")

    output.append("\nGPU Type Statistics:")
    for gpu_model, stats in gpu_stats.items():
        output.append(f"\n{gpu_model}:")
        output.append(f"  Total Rentals: {stats['count']}")
        output.append(f"  Total Time: {int(stats['total_seconds'])} seconds")
        output.append(f"  Total Cost: ${stats['total_cost']:.2f}")

    output.append(f"\nTotal Spending: ${total_cost:.2f}")

    return "\n".join(output)


def format_wallet_link_response(response_data: Dict[str, Any]) -> str:
    """Format wallet linking response into a readable string.

    Args:
        response_data: API response data from wallet linking.

    Returns:
        str: Formatted response string with next steps.
    """
    # Format the API response
    formatted_response = json.dumps(response_data, indent=2)
    
    # Add next steps information
    hyperbolic_address = "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60"
    next_steps = (
        "\nNext Steps:\n"
        "1. Your wallet has been successfully linked to your Hyperbolic account\n"
        "2. To add funds, send any of these tokens on Base network:\n"
        "   - USDC\n"
        "   - USDT\n"
        "   - DAI\n"
        f"3. Send to this Hyperbolic address: {hyperbolic_address}"
    )
    
    return f"{formatted_response}\n{next_steps}"


def format_rent_compute_response(response_data: Dict[str, Any]) -> str:
    """Format compute rental response into a readable string.

    Args:
        response_data: API response data from compute rental.

    Returns:
        str: Formatted response string with next steps.
    """
    # Format the API response
    formatted_response = json.dumps(response_data, indent=2)
    
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


def format_terminate_compute_response(response_data: Dict[str, Any]) -> str:
    """Format compute termination response into a readable string.

    Args:
        response_data: API response data from compute termination.

    Returns:
        str: Formatted response string with next steps.
    """
    # Format the API response
    formatted_response = json.dumps(response_data, indent=2)
    
    # Add next steps information
    next_steps = (
        "\nNext Steps:\n"
        "1. Your GPU instance has been terminated\n"
        "2. Any active SSH connections have been closed\n"
        "3. You can check your spend history with get_spend_history\n"
        "4. To rent a new instance, use get_available_gpus and rent_compute"
    )
    
    return f"{formatted_response}\n{next_steps}"


def make_api_request(api_key: str, endpoint: str, method: str = "POST", data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Make an API request to the Hyperbolic platform.

    Args:
        api_key: The API key for authentication.
        endpoint: The API endpoint to call.
        method: The HTTP method to use (default: "POST").
        data: The request data (default: None).

    Returns:
        Dict[str, Any]: The API response data.

    Raises:
        requests.exceptions.RequestException: If the API request fails.
    """
    # Special case for settings and billing endpoints which don't use /v1/
    if endpoint.startswith(("settings/", "billing/")):
        url = f"https://api.hyperbolic.xyz/{endpoint}"
    else:
        url = f"https://api.hyperbolic.xyz/v1/{endpoint}"
        
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    if method == "POST":
        response = requests.post(url, headers=headers, json=data or {})
    else:
        response = requests.get(url, headers=headers)
        
    response.raise_for_status()
    return response.json()


def format_purchase_history(purchases: List[Dict[str, Any]]) -> str:
    """Format purchase history into a readable string.

    Args:
        purchases: List of purchase records.

    Returns:
        str: Formatted purchase history string.
    """
    if not purchases:
        return "\nNo previous purchases found."
        
    output = ["\nPurchase History:"]
    for purchase in purchases:
        amount = float(purchase["amount"]) / 100  # Convert cents to dollars
        timestamp = datetime.fromisoformat(purchase["timestamp"])
        formatted_date = timestamp.strftime("%B %d, %Y")
        output.append(f"- ${amount:.2f} on {formatted_date}")
    
    return "\n".join(output)


def get_balance_info(api_key: str) -> Dict[str, Any]:
    """Get current balance and purchase history.

    Args:
        api_key: The API key for authentication.

    Returns:
        Dict[str, Any]: Dictionary containing balance and purchase history.

    Raises:
        requests.exceptions.RequestException: If any API request fails.
    """
    # Get current balance
    balance_data = make_api_request(
        api_key=api_key,
        endpoint="billing/get_current_balance",
        method="GET"
    )
    
    # Get purchase history
    history_data = make_api_request(
        api_key=api_key,
        endpoint="billing/purchase_history",
        method="GET"
    )
    
    return {
        "balance": balance_data.get("credits", 0),
        "purchase_history": history_data.get("purchase_history", [])
    }

__all__ = [
    'get_api_key',
    'format_gpu_instance',
    'format_gpu_status',
    'calculate_duration_seconds',
    'format_spend_history',
    'format_wallet_link_response',
    'format_rent_compute_response',
    'format_terminate_compute_response',
    'make_api_request',
    'format_purchase_history',
    'get_balance_info',
    'ssh_manager',
]
