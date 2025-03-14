"""SSH Connection.

This module implements the SSHConnection class, which manages SSH connections
to remote servers and provides functionality for executing commands.

@module ssh/connection
"""

import contextlib
import io
import os
from datetime import datetime

import paramiko
from pydantic import BaseModel, Field, model_validator


class SSHConnectionParams(BaseModel):
    """Validates SSH connection parameters."""

    connection_id: str = Field(description="Unique identifier for this connection")
    host: str = Field(description="Remote server hostname/IP")
    username: str = Field(description="SSH username")
    password: str | None = Field(None, description="SSH password for authentication")
    private_key: str | None = Field(None, description="SSH private key content as a string")
    private_key_path: str | None = Field(
        None, description="Path to private key file for authentication"
    )
    port: int = Field(22, description="SSH port number")

    @classmethod
    @model_validator(mode="after")
    def check_auth_method_provided(cls):
        """Ensure at least one authentication method is provided."""
        if not any([cls.password, cls.private_key, cls.private_key_path]):
            raise ValueError(
                "At least one authentication method must be provided (password, private_key, or private_key_path)"
            )

        if not cls.host:
            raise ValueError("Host must be provided")
        if not cls.username:
            raise ValueError("Username must be provided")

        return cls


class SSHConnectionError(Exception):
    """Exception raised for SSH connection errors."""

    pass


class SSHKeyError(Exception):
    """Exception raised for SSH key-related errors."""

    pass


class UnknownHostKeyError(SSHConnectionError):
    """Exception raised when a host key is not recognized.

    This includes information to add the key using the ssh_add_host_key action.
    """

    def __init__(self, message: str):
        """Initialize with error message.

        Args:
            message: The error message with host key information

        """
        super().__init__(message)


class CapturingRejectPolicy(paramiko.MissingHostKeyPolicy):
    """A host key policy that rejects unknown host keys but captures their details."""

    def missing_host_key(self, client, hostname, key):
        """Handle an unknown host key encounter.

        Args:
            client: The SSHClient instance
            hostname: The server hostname or IP
            key: The server's host key

        Raises:
            UnknownHostKeyError: Always, with host key details

        """
        key_type = key.get_name()
        key_data = key.get_base64()

        message = (
            f"Host key verification failed for {hostname}. Server sent:\n"
            f"  {key_type} {key_data}\n\n"
            f"To add this host key, use the ssh_add_host_key action with the following parameters:\n"
            f"  host: {hostname}\n"
            f"  key: {key_data}\n"
            f"  key_type: {key_type}"
        )

        raise UnknownHostKeyError(message)


class SSHConnection:
    """Manages an SSH connection to a remote server.

    This class encapsulates all SSH connection functionality including
    establishing connections, executing commands, and managing the connection state.
    """

    def __init__(self, params: SSHConnectionParams):
        """Initialize SSH connection.

        Args:
            params: SSH connection parameters

        Raises:
            ValueError: If the parameters are invalid

        """
        self.params = params

        self.connected = False
        self.connection_time = None
        self.known_hosts_file = None

        self.ssh_client = None

    def is_connected(self) -> bool:
        """Check if there's an active SSH connection.

        Returns:
            bool: Whether the connection is active

        """
        if not self.ssh_client:
            return False

        if not self.connected:
            return False

        result = None

        try:
            _, stdout, _ = self.ssh_client.exec_command("echo 1", timeout=5)
            result = stdout.read().decode().strip()
        except Exception:
            pass

        if result != "1":
            self.reset_connection()
            return False

        return True

    def reset_connection(self) -> None:
        """Reset the connection state."""
        self.connected = False
        self.connection_time = None

        if not self.ssh_client:
            return

        with contextlib.suppress(Exception):
            self.ssh_client.close()

        self.ssh_client = None

    def connect(self) -> None:
        """Establish SSH connection using instance attributes.

        Raises:
            SSHKeyError: If there's an issue with the SSH key
            SSHConnectionError: If the connection fails
            UnknownHostKeyError: If the host key is not recognized

        """
        params = self.params
        self.disconnect()

        try:
            if params.password:
                self.connect_with_password(
                    params.host, params.username, params.password, params.port
                )
            elif params.private_key:
                self.connect_with_key(
                    params.host,
                    params.username,
                    params.private_key,
                    params.port,
                    password=params.password,
                )
            else:
                private_key_path = params.private_key_path or os.getenv(
                    "SSH_PRIVATE_KEY_PATH", "~/.ssh/id_rsa"
                )
                private_key_path = os.path.expanduser(private_key_path)
                self.connect_with_key_path(
                    params.host,
                    params.username,
                    private_key_path,
                    params.port,
                    password=params.password,
                )

            _, stdout, stderr = self.ssh_client.exec_command(
                'echo "Connection successful"', timeout=5
            )
            result = stdout.read().decode().strip()

            if result != "Connection successful":
                e = stderr.read().decode().strip()
                self.connected = False
                raise SSHConnectionError(f"Connection test failed: {e!s}")

            self.connected = True
            self.connection_time = datetime.now()

        except UnknownHostKeyError:
            self.reset_connection()
            raise

    def _load_key_from_string(self, key_string: str, password: str | None = None) -> paramiko.PKey:
        """Load a private key from a string.

        This method attempts to load the key as different formats (RSA, DSS, ECDSA, Ed25519)
        until one succeeds. RSA keys are tried first for test compatibility.

        Args:
            key_string: Private key content as a string
            password: Optional password for encrypted keys

        Returns:
            paramiko.PKey: The loaded key

        Raises:
            SSHKeyError: If there's an issue with the key

        """
        key_file = io.StringIO(key_string)
        key_classes = [
            paramiko.RSAKey,
            paramiko.DSSKey,
            paramiko.ECDSAKey,
            paramiko.Ed25519Key,
        ]

        password_required = False
        last_error = None

        for key_class in key_classes:
            key_file.seek(0)
            try:
                return key_class.from_private_key(key_file, password=password)
            except paramiko.ssh_exception.PasswordRequiredException:
                password_required = True
            except paramiko.ssh_exception.SSHException as e:
                last_error = e
                continue
            except Exception as e:
                raise SSHKeyError(f"Failed to load key from string: {e!s}") from e

        if password_required:
            raise SSHKeyError("Password-protected key provided but no password was given")

        if last_error:
            raise SSHKeyError(f"Failed to load key from string: {last_error!s}")

        raise SSHKeyError("Key format not supported or invalid key data")

    def _init_ssh_client(self):
        """Initialize the SSH client with appropriate host key settings."""
        self.ssh_client = paramiko.SSHClient()
        self.ssh_client.load_system_host_keys()

        if self.known_hosts_file:
            try:
                known_hosts_path = os.path.expanduser(self.known_hosts_file)
                if os.path.exists(known_hosts_path):
                    self.ssh_client.load_host_keys(known_hosts_path)
            except Exception as e:
                print(f"Warning: Failed to load known_hosts file: {e!s}")

        self.ssh_client.set_missing_host_key_policy(CapturingRejectPolicy())

    def connect_with_key(
        self,
        host: str,
        username: str,
        private_key: str | paramiko.RSAKey,
        port: int = 22,
        timeout: int = 10,
        password: str | None = None,
    ) -> None:
        """Connect to a remote server using a private key.

        Args:
            host: Remote server hostname/IP
            username: SSH username
            private_key: SSH private key as string or paramiko.RSAKey object
            port: SSH port number (default: 22)
            timeout: Connection timeout in seconds (default: 10)
            password: Optional password for encrypted keys

        """
        try:
            self.disconnect()
            self._init_ssh_client()

            if isinstance(private_key, str):
                key_obj = self._load_key_from_string(private_key, password=password)
            else:
                key_obj = private_key

            self.ssh_client.connect(
                hostname=host, username=username, pkey=key_obj, port=port, timeout=timeout
            )
        except SSHKeyError:
            raise
        except UnknownHostKeyError:
            raise
        except Exception as e:
            raise SSHConnectionError(f"Failed to connect with key: {e!s}") from e

    def connect_with_key_path(
        self,
        host: str,
        username: str,
        private_key_path: str,
        port: int = 22,
        timeout: int = 10,
        password: str | None = None,
    ) -> None:
        """Connect to a remote server using a private key from file.

        Args:
            host: Remote server hostname/IP
            username: SSH username
            private_key_path: Path to SSH private key file
            port: SSH port number (default: 22)
            timeout: Connection timeout in seconds (default: 10)
            password: Optional password for encrypted keys

        Raises:
            SSHKeyError: If there's an issue with the SSH key
            SSHConnectionError: If the connection fails

        """
        private_key_path = os.path.expanduser(private_key_path)
        if not os.path.exists(private_key_path):
            raise SSHKeyError(f"Key file not found at {private_key_path}")

        try:
            key_obj = self._load_key_from_file(private_key_path, password=password)
            self.connect_with_key(host, username, key_obj, port, timeout)
        except SSHKeyError:
            raise
        except UnknownHostKeyError:
            raise
        except Exception as e:
            raise SSHConnectionError(f"Failed to connect with key file: {e!s}") from e

    def _load_key_from_file(self, key_path: str, password: str | None = None) -> paramiko.PKey:
        """Load a private key from a file.

        This method attempts to load the key as different formats (RSA, DSS, ECDSA, Ed25519)
        until one succeeds. RSA keys are tried first for test compatibility.

        Args:
            key_path: Path to the key file
            password: Optional password for encrypted keys

        Returns:
            paramiko.PKey: The loaded key

        Raises:
            SSHKeyError: If there's an issue with the key file

        """
        key_classes = [
            paramiko.RSAKey,
            paramiko.DSSKey,
            paramiko.ECDSAKey,
            paramiko.Ed25519Key,
        ]

        password_required = False
        last_error = None

        for key_class in key_classes:
            try:
                return key_class.from_private_key_file(key_path, password=password)
            except paramiko.ssh_exception.PasswordRequiredException:
                password_required = True
            except paramiko.ssh_exception.SSHException as e:
                last_error = e
                continue
            except FileNotFoundError as e:
                raise SSHKeyError(f"Failed to load key file {key_path}: {e!s}") from e
            except Exception as e:
                raise SSHKeyError(f"Failed to load key file {key_path}: {e!s}") from e

        if password_required:
            raise SSHKeyError("Password-protected key file requires a password")

        if last_error:
            raise SSHKeyError(f"Invalid key format in {key_path}: {last_error!s}")

        raise SSHKeyError(f"Key format not supported or invalid key file {key_path}")

    def connect_with_password(
        self,
        host: str,
        username: str,
        password: str,
        port: int = 22,
        timeout: int = 10,
    ) -> None:
        """Connect to a remote server using password authentication.

        Args:
            host: Remote server hostname/IP
            username: SSH username
            password: SSH password
            port: SSH port number (default: 22)
            timeout: Connection timeout in seconds (default: 10)

        """
        try:
            self.disconnect()
            self._init_ssh_client()
            self.ssh_client.connect(
                hostname=host, username=username, password=password, port=port, timeout=timeout
            )
        except UnknownHostKeyError:
            raise
        except Exception as e:
            raise SSHConnectionError(f"Failed to connect with password: {e!s}") from e

    def execute(self, command: str, timeout: int = 30, ignore_stderr: bool = False) -> str:
        """Execute command on connected server.

        Args:
            command: Shell command to execute
            timeout: Command execution timeout in seconds
            ignore_stderr: If True, stderr output won't cause exceptions

        Returns:
            str: Command output (stdout) and optionally stderr if present

        Raises:
            SSHConnectionError: If connection is lost or command execution fails

        """
        params = self.params
        if not self.is_connected():
            raise SSHConnectionError(
                f"No active SSH connection for {params.connection_id}. Please connect first."
            )

        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(command, timeout=timeout)
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode()
            error_output = stderr.read().decode()

            if error_output and (ignore_stderr or exit_status == 0):
                if output:
                    return f"{output}\n[stderr]: {error_output}"
                return error_output

            if exit_status != 0 and error_output:
                raise SSHConnectionError(
                    f"Command execution failed on {params.connection_id} (exit code {exit_status}): {error_output}"
                )

            if exit_status != 0:
                raise SSHConnectionError(
                    f"Command execution failed on {params.connection_id} with exit code {exit_status}"
                )

            if not output and exit_status == 0:
                return ""

            return output

        except Exception as e:
            self.reset_connection()
            raise SSHConnectionError(
                f"Command execution failed on {params.connection_id}: {e!s}"
            ) from e

    def disconnect(self) -> None:
        """Close SSH connection.

        Raises:
            SSHConnectionError: If disconnection fails

        """
        self.reset_connection()

    def get_connection_info(self) -> str:
        """Get information about the current connection.

        Returns:
            str: Connection information as a formatted string

        """
        params = self.params
        output = [
            f"Connection ID: {params.connection_id}",
        ]

        if self.is_connected():
            connection_time = (
                self.connection_time.strftime("%Y-%m-%d %H:%M:%S")
                if self.connection_time
                else "Unknown"
            )
            output.extend(
                [
                    "Status: Connected",
                    f"Host: {params.host}:{params.port}",
                    f"Username: {params.username}",
                    f"Connected since: {connection_time}",
                ]
            )
        else:
            output.append("Status: Not connected")

        return "\n".join(output)

    def get_sftp_client(self) -> paramiko.SFTPClient:
        """Get an SFTP client from the current SSH connection.

        Returns:
            paramiko.SFTPClient: SFTP client object

        Raises:
            SSHConnectionError: If there's no active connection or SFTP initialization fails

        """
        if not self.is_connected():
            raise SSHConnectionError("No active SSH connection. Please connect first.")

        try:
            return self.ssh_client.open_sftp()
        except Exception as e:
            self.reset_connection()
            raise SSHConnectionError(f"Failed to initialize SFTP client: {e!s}") from e

    def upload_file(self, local_path: str, remote_path: str) -> None:
        """Upload a local file to the remote server.

        Args:
            local_path: Path to the local file
            remote_path: Destination path on the remote server

        Raises:
            SSHConnectionError: If connection is lost or file transfer fails
            FileNotFoundError: If the local file doesn't exist

        """
        params = self.params
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        try:
            sftp = self.get_sftp_client()
            sftp.put(local_path, remote_path)
            sftp.close()
        except Exception as e:
            self.reset_connection()
            raise SSHConnectionError(f"File upload failed for {params.connection_id}: {e!s}") from e

    def download_file(self, remote_path: str, local_path: str) -> None:
        """Download a file from the remote server.

        Args:
            remote_path: Path to the file on the remote server
            local_path: Destination path on the local machine

        Raises:
            SSHConnectionError: If connection is lost or file transfer fails

        """
        params = self.params
        try:
            sftp = self.get_sftp_client()
            sftp.get(remote_path, local_path)
            sftp.close()
        except Exception as e:
            self.reset_connection()
            raise SSHConnectionError(
                f"File download failed for {params.connection_id}: {e!s}"
            ) from e

    def list_directory(self, remote_path: str) -> list[str]:
        """List contents of a directory on the remote server.

        Args:
            remote_path: Path to the directory on the remote server

        Returns:
            list[str]: List of filenames in the directory

        Raises:
            SSHConnectionError: If connection is lost or directory listing fails

        """
        params = self.params
        try:
            sftp = self.get_sftp_client()
            files = sftp.listdir(remote_path)
            sftp.close()
            return files
        except Exception as e:
            self.reset_connection()
            raise SSHConnectionError(
                f"Directory listing failed on {params.connection_id}: {e!s}"
            ) from e

    def __enter__(self):
        """Enter context manager.

        Returns:
            SSHConnection: The connection instance

        """
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager and close all connections.

        Args:
            exc_type: Exception type
            exc_val: Exception value
            exc_tb: Exception traceback

        """
        self.disconnect()
