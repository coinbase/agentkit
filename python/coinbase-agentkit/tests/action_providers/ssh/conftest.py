"""Test fixtures for ssh action provider tests."""

from unittest import mock

import paramiko
import pytest

from coinbase_agentkit.action_providers.ssh.connection import SSHConnection, SSHConnectionParams
from coinbase_agentkit.action_providers.ssh.ssh_action_provider import SshActionProvider

MOCK_CONNECTION_ID = "test-conn"
MOCK_CONNECTION_HOST = "test-host"
MOCK_CONNECTION_USERNAME = "test-user"
MOCK_CONNECTION_PORT = 22
MOCK_CONNECTION_PASSWORD = "test-pass"
MOCK_CONNECTION_INFO = "Connection Info Mock"


@pytest.fixture
def mock_ssh_client():
    """Create a mock SSH client with standard behaviors."""
    mock_client = mock.Mock(spec=paramiko.SSHClient)

    mock_stdout = mock.Mock()
    mock_stdout.read.return_value = b"Connection successful"
    mock_stdout.channel = mock.Mock()
    mock_stdout.channel.recv_exit_status.return_value = 0

    mock_stderr = mock.Mock()
    mock_stderr.read.return_value = b""

    mock_client.mock_stdout = mock_stdout
    mock_client.mock_stderr = mock_stderr

    mock_client.exec_command.return_value = (None, mock_stdout, mock_stderr)

    mock_transport = mock.Mock()
    mock_transport.is_active.return_value = True
    mock_client.get_transport.return_value = mock_transport

    return mock_client


@pytest.fixture
def mock_rsa_key():
    """Create a mock RSA key."""
    mock_key = mock.Mock(spec=paramiko.RSAKey)
    mock_key.from_private_key_file.return_value = mock_key
    mock_key.from_private_key.return_value = mock_key
    return mock_key


@pytest.fixture
def mock_fs():
    """Create mock filesystem operations."""
    with (
        mock.patch("os.path.exists") as mock_exists,
        mock.patch("os.path.expanduser") as mock_expanduser,
        mock.patch("os.path.dirname") as mock_dirname,
        mock.patch("os.makedirs") as mock_makedirs,
    ):
        mock_exists.return_value = True
        mock_expanduser.side_effect = lambda x: x.replace("~", "/home/user")
        mock_dirname.side_effect = lambda x: "/".join(x.split("/")[:-1])
        yield {
            "exists": mock_exists,
            "expanduser": mock_expanduser,
            "dirname": mock_dirname,
            "makedirs": mock_makedirs,
        }


@pytest.fixture
def connection_params():
    """Create a standard set of connection parameters for testing."""
    return SSHConnectionParams(
        connection_id=MOCK_CONNECTION_ID,
        host=MOCK_CONNECTION_HOST,
        username=MOCK_CONNECTION_USERNAME,
        password=MOCK_CONNECTION_PASSWORD,
        port=MOCK_CONNECTION_PORT,
    )


@pytest.fixture
def ssh_connection(mock_ssh_client, connection_params):
    """Create an SSH connection instance with all mocks configured."""
    conn = SSHConnection(connection_params)
    conn.ssh_client = mock_ssh_client
    conn.connected = False

    def set_connected(connected=True):
        conn.connected = connected
        return mock.patch.object(conn, "is_connected", return_value=connected)

    conn.set_connected = set_connected

    return conn


@pytest.fixture
def ssh_provider():
    """Create a SshActionProvider instance with mocked connections for testing."""
    with mock.patch(
        "coinbase_agentkit.action_providers.ssh.ssh_action_provider.SSHConnectionPool"
    ) as mock_pool_class:
        mock_pool = mock_pool_class.return_value

        mock_pool.has_connection.return_value = False
        mock_pool.get_connections.return_value = {}

        mock_connection = mock.Mock()
        mock_connection.params.host = MOCK_CONNECTION_HOST
        mock_connection.params.username = MOCK_CONNECTION_USERNAME
        mock_connection.params.port = MOCK_CONNECTION_PORT
        mock_connection.is_connected.return_value = True
        mock_connection.get_connection_info.return_value = MOCK_CONNECTION_INFO

        mock_pool.get_connection.return_value = mock_connection
        mock_pool.create_connection.return_value = mock_connection
        mock_pool.close_connection.return_value = mock_connection

        provider = SshActionProvider()
        provider.connection_pool = mock_pool
        return provider
