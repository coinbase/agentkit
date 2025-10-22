"""SSH Action Provider.

This module implements the SSH Action Provider, which enables executing
commands on remote servers via SSH, file transfers via SFTP, and connection management.

@module ssh/ssh_action_provider
"""

import contextlib
import os
import uuid
from typing import Any

import paramiko
from pydantic import ValidationError

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .connection import SSHConnectionError, SSHKeyError, UnknownHostKeyError
from .connection_pool import SSHConnectionPool
from .schemas import (
    AddHostKeySchema,
    ConnectionStatusSchema,
    DisconnectSchema,
    FileDownloadSchema,
    FileUploadSchema,
    ListConnectionsSchema,
    RemoteShellSchema,
    SSHConnectionSchema,
)


class SshActionProvider(ActionProvider):
    """SshActionProvider provides actions for SSH operations.

    This provider enables connecting to remote servers via SSH and executing commands.
    It supports managing multiple concurrent SSH connections.
    """

    def __init__(self, max_connections: int = 10):
        """Initialize the SshActionProvider."""
        super().__init__("ssh", [])
        self.connection_pool = SSHConnectionPool(max_connections=max_connections)

    @create_action(
        name="ssh_connect",
        description="""
This tool establishes an SSH connection to a remote server.

Required inputs:
- host: Hostname or IP address
- username: SSH username

Optional inputs:
- connection_id: Unique ID (auto-generated if omitted)
- password: SSH password
- private_key: SSH private key as string
- private_key_path: Path to key file
- port: SSH port (default: 22)
- known_hosts_file: Path to custom known_hosts file

Example successful response:
    Connection ID: my_server
    Successfully connected to host.example.com as username

Example error response:
    SSH Connection Error: Authentication failed
    SSH Connection Error: Connection refused
    SSH Key Error: Key file not found
    Host key verification failed: Use ssh_add_host_key

Important notes:
- Maintains multiple simultaneous connections
- Use remote_shell to execute commands after connecting
- Either password or key authentication required
- Default key path is ~/.ssh/id_rsa
- If host key verification fails, use ssh_add_host_key
""",
        schema=SSHConnectionSchema,
    )
    def ssh_connect(self, args: dict[str, Any]) -> str:
        """Establish SSH connection to remote server.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            if args.get("connection_id") is None:
                args["connection_id"] = str(uuid.uuid4())

            validated_args = SSHConnectionSchema(**args)
            connection_id = validated_args.connection_id

            with contextlib.suppress(SSHConnectionError):
                self.connection_pool.close_connection(connection_id)

            connection = self.connection_pool.create_connection(validated_args)
            connection.connect()

            output = [
                f"Connection ID: {connection_id}",
                f"Successfully connected to {connection.params.host} as {connection.params.username}",
            ]

            return "\n".join(output)

        except UnknownHostKeyError as e:
            return f"Error: Host verification: {e!s}"
        except SSHConnectionError as e:
            return f"Error: Connection: {e!s}"
        except SSHKeyError as e:
            return f"Error: SSH key issue: {e!s}"
        except ValidationError as e:
            return f"Error: Invalid input parameters: {e!s}"

    @create_action(
        name="remote_shell",
        description="""
This tool executes shell commands on a remote server via SSH.

Required inputs:
- connection_id: Identifier for the SSH connection to use
- command: The shell command to execute on the remote server
- ignore_stderr: If True, stderr output won't cause exceptions
- timeout: Command execution timeout in seconds

Example successful response:
    Output from connection 'my_server':

    Command output from remote server

Example error response:
    Error: No active SSH connection. Please connect first.
    Error: Invalid connection ID.
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
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = RemoteShellSchema(**args)
            connection_id = validated_args.connection_id
            command = validated_args.command.strip()
            ignore_stderr = validated_args.ignore_stderr
            timeout = validated_args.timeout

            if not self.connection_pool.has_connection(connection_id):
                return f"Error: Connection ID '{connection_id}' not found. Use ssh_connect first."

            connection = self.connection_pool.get_connection(connection_id)
            if not connection.is_connected():
                return f"Error: Connection state: Connection '{connection_id}' is not currently active. Use ssh_connect to establish the connection."

            result = connection.execute(command, timeout=timeout, ignore_stderr=ignore_stderr)
            return f"Output from connection '{connection_id}':\n\n{result}"

        except SSHConnectionError as e:
            return f"Error: Connection: {e!s}. Please reconnect using ssh_connect."
        except ValidationError as e:
            return f"Error: Invalid parameters: {e!s}"
        except Exception as e:
            return f"Error: Command execution: {e!s}"

    @create_action(
        name="ssh_disconnect",
        description="""
This tool disconnects an active SSH connection.

Required inputs:
- connection_id: Identifier for the SSH connection to disconnect

Example successful response:
    Connection ID: my_server
    Disconnected from host.example.com

Example error response:
    Error: Invalid connection ID.

Important notes:
- After disconnection, the connection ID is no longer valid
- You will need to establish a new connection to reconnect
""",
        schema=DisconnectSchema,
    )
    def ssh_disconnect(self, args: dict[str, Any]) -> str:
        """Disconnects from an active SSH session.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = DisconnectSchema(**args)
            connection_id = validated_args.connection_id

            connection = self.connection_pool.close_connection(connection_id)

            result = (
                f"Connection ID: {connection_id}\nDisconnected from {connection.params.host}"
                if connection
                else f"Connection ID: {connection_id}\nNo active connection to disconnect"
            )

            return result

        except SSHConnectionError as e:
            return f"Error: Connection: {e!s}"
        except ValidationError as e:
            return f"Error: Invalid parameters: {e!s}"
        except Exception as e:
            return f"Error disconnecting: {e!s}"

    @create_action(
        name="ssh_status",
        description="""
This tool checks the status of a specific SSH connection.

Required inputs:
- connection_id: Identifier for the SSH connection to check

Example successful response:
    Connection ID: my_server
    Status: Connected
    Host: 192.168.1.100:22
    Username: admin
    Connected since: 2023-01-01 12:34:56

Example error response:
    Error: Invalid connection ID.

Important notes:
- Use this to verify connection status before executing commands
- To list all connections, use the list_connections action
""",
        schema=ConnectionStatusSchema,
    )
    def ssh_status(self, args: dict[str, Any]) -> str:
        """Retrieve status of a specific SSH connection.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = ConnectionStatusSchema(**args)
            connection_id = validated_args.connection_id

            connection = self.connection_pool.get_connection(connection_id)
            return connection.get_connection_info()
        except SSHConnectionError as e:
            return f"Error: Connection not found: {e!s}"
        except ValidationError as e:
            return f"Error: Invalid input parameters: {e!s}"

    @create_action(
        name="list_connections",
        description="""
This tool lists all active SSH connections.

It does not take any inputs.

Example successful response:
    Active SSH Connections: 2

    Connection ID: server1
    Status: Connected
    Host: 192.168.1.100:22
    Username: admin

    Connection ID: server2
    Status: Not connected

Example error response:
    No active SSH connections
""",
        schema=ListConnectionsSchema,
    )
    def list_connections(self, args: dict[str, Any]) -> str:
        """List all SSH connections in the pool.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            connections = self.connection_pool.get_connections()
            if not connections:
                return "No active SSH connections"

            result = [f"Active SSH Connections: {len(connections)}"]

            for conn_id, connection in connections.items():
                if len(result) > 1:
                    result.append("")

                if connection.is_connected():
                    result.append(f"Connection ID: {conn_id}")
                    result.append("Status: Connected")
                    result.append(f"Host: {connection.params.host}:{connection.params.port}")
                    result.append(f"Username: {connection.params.username}")
                else:
                    result.append(f"Connection ID: {conn_id}")
                    result.append("Status: Not connected")

            return "\n".join(result)

        except Exception as e:
            return f"Error: Connection listing: {e!s}"

    @create_action(
        name="ssh_upload",
        description="""
This tool uploads a file to a remote server via SFTP.

Required inputs:
- connection_id: Identifier for the SSH connection to use
- local_path: Path to the local file to upload
- remote_path: Destination path on the remote server

Example successful response:
    File upload successful:
    Local file: /path/to/local/file.txt
    Remote destination: /path/on/server/file.txt

Example error response:
    Error: No active SSH connection. Please connect first.
    Error: Local file not found.
    Error: Permission denied on remote server.

Important notes:
- Requires an active SSH connection (use ssh_connect first)
- Local path must be accessible to the agent
- Remote path must include the target filename, not just a directory
- User running the agent must have permission to read the local file
- SSH user must have permission to write to the remote location
""",
        schema=FileUploadSchema,
    )
    def ssh_upload(self, args: dict[str, Any]) -> str:
        """Upload a file to the remote server.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = FileUploadSchema(**args)
            connection_id = validated_args.connection_id
            local_path = validated_args.local_path
            remote_path = validated_args.remote_path

            if not self.connection_pool.has_connection(connection_id):
                return f"Error: Connection ID '{connection_id}' not found. Use ssh_connect first."

            if not os.path.exists(local_path):
                return f"Error: Local file not found at {local_path}"

            if not os.path.isfile(local_path):
                return f"Error: {local_path} is not a file"

            connection = self.connection_pool.get_connection(connection_id)

            if not connection.is_connected():
                return f"Error: Connection '{connection_id}' is not currently active. Use ssh_connect to establish the connection."

            connection.upload_file(local_path, remote_path)

            return (
                f"File upload successful:\n"
                f"Local file: {local_path}\n"
                f"Remote destination: {remote_path}"
            )

        except SSHConnectionError as e:
            return f"Error: SSH connection: {e!s}"
        except paramiko.SFTPError as e:
            return f"Error: SFTP operation: {e!s}"
        except OSError as e:
            return f"Error: I/O operation: {e!s}"
        except ValidationError as e:
            return f"Error: Invalid input parameters: {e!s}"
        except Exception as e:
            return f"Error: File upload: {e!s}"

    @create_action(
        name="ssh_download",
        description="""
This tool downloads a file from a remote server via SFTP.

Required inputs:
- connection_id: Identifier for the SSH connection to use
- remote_path: Path to the file on the remote server
- local_path: Destination path on the local machine

Example successful response:
    File download successful:
    Remote file: /path/on/server/file.txt
    Local destination: /path/to/local/file.txt

Example error response:
    Error: No active SSH connection. Please connect first.
    Error: Remote file not found.
    Error: Permission denied on local machine.

Important notes:
- Requires an active SSH connection (use ssh_connect first)
- Remote file must exist and be readable by the SSH user
- Local path must include the target filename, not just a directory
- User running the agent must have permission to write to the local path
- If the local file already exists, it will be overwritten
""",
        schema=FileDownloadSchema,
    )
    def ssh_download(self, args: dict[str, Any]) -> str:
        """Download a file from the remote server.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = FileDownloadSchema(**args)
            connection_id = validated_args.connection_id
            remote_path = validated_args.remote_path
            local_path = validated_args.local_path

            if not self.connection_pool.has_connection(connection_id):
                return f"Error: Connection ID '{connection_id}' not found. Use ssh_connect first."

            connection = self.connection_pool.get_connection(connection_id)

            if not connection.is_connected():
                return f"Error: Connection '{connection_id}' is not currently active. Use ssh_connect to establish the connection."

            local_path = os.path.expanduser(local_path)

            local_dir = os.path.dirname(local_path)
            if local_dir and not os.path.exists(local_dir):
                os.makedirs(local_dir)

            connection.download_file(remote_path, local_path)

            return (
                f"File download successful:\n"
                f"Remote file: {remote_path}\n"
                f"Local destination: {local_path}"
            )

        except SSHConnectionError as e:
            return f"Error: SSH connection: {e!s}"
        except paramiko.SFTPError as e:
            return f"Error: SFTP operation: {e!s}"
        except OSError as e:
            return f"Error: I/O operation: {e!s}"
        except ValidationError as e:
            return f"Error: Invalid input parameters: {e!s}"
        except Exception as e:
            return f"Error: File download: {e!s}"

    @create_action(
        name="ssh_add_host_key",
        description="""
This tool adds an SSH host key to the local known_hosts file.

Required inputs:
- host: Hostname or IP of server. For non-standard ports, use "[hostname]:port".
  Example: "[example.com]:2222"
- key: The SSH host key to add
- key_type: Type of SSH key (default: ssh-rsa, e.g., ssh-ed25519)

Optional inputs:
- known_hosts_file: Path to known_hosts file (default: ~/.ssh/known_hosts)

Example successful response:
    Host key for 'example.com' successfully added to ~/.ssh/known_hosts
    Host key for '[example.com]:2222' successfully added to ~/.ssh/known_hosts

Example error response:
    Error: Unable to access known_hosts file

Important notes:
- This tool modifies the local known_hosts file
- Host keys are typically obtained from SSH connection errors
- For non-standard ports, OpenSSH format [hostname]:port is required
- Existing entries for the same host will be updated (not duplicated)
""",
        schema=AddHostKeySchema,
    )
    def ssh_add_host_key(self, args: dict[str, Any]) -> str:
        """Add an SSH host key to the known_hosts file.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = AddHostKeySchema(**args)
            host = validated_args.host
            key = validated_args.key
            key_type = validated_args.key_type
            known_hosts_file = os.path.expanduser(validated_args.known_hosts_file)

            host_entry = host
            entry = f"{host_entry} {key_type} {key}\n"

            known_hosts_dir = os.path.dirname(known_hosts_file)
            if known_hosts_dir and not os.path.exists(known_hosts_dir):
                os.makedirs(known_hosts_dir, mode=0o700, exist_ok=True)

            existing_entry = False
            existing_lines = []

            if os.path.exists(known_hosts_file):
                with open(known_hosts_file) as f:
                    existing_lines = f.readlines()

                for i, line in enumerate(existing_lines):
                    if line.strip() and line.split()[0] == host_entry:
                        existing_lines[i] = entry
                        existing_entry = True
                        break

            if existing_entry:
                with open(known_hosts_file, "w") as f:
                    f.writelines(existing_lines)
                return f"Host key for '{host_entry}' updated in {known_hosts_file}"
            else:
                with open(known_hosts_file, "a+") as f:
                    f.write(entry)
                return f"Host key for '{host_entry}' successfully added to {known_hosts_file}"

        except ValidationError as e:
            return f"Error: Invalid input parameters: {e!s}"
        except FileNotFoundError as e:
            return f"Error: Unable to access known_hosts file: {e!s}"
        except PermissionError as e:
            return f"Error: Permission denied when accessing known_hosts file: {e!s}"
        except OSError as e:
            return f"Error: File operation: {e!s}"
        except Exception as e:
            return f"Error: Host key addition: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if this provider supports the specified network.

        Args:
            network: The network to check.

        Returns:
            bool: Always True as SSH is network-agnostic.

        """
        return True


def ssh_action_provider(
    max_connections: int = 10,
) -> SshActionProvider:
    """Create a new instance of the SshActionProvider.

    Args:
        max_connections: Maximum number of concurrent SSH connections (default: 10)

    Returns:
        An initialized SshActionProvider

    """
    return SshActionProvider(max_connections=max_connections)
