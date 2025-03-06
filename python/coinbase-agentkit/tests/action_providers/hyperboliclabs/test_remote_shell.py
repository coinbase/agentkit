"""Tests for remote_shell action in HyperbolicActionProvider."""

from datetime import datetime
from unittest.mock import Mock, PropertyMock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.utils import SSHManager, ssh_manager


@pytest.fixture
def mock_instances_response():
    """Mock API response for instances list."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instances": [
            {
                "id": "instance-123",
                "status": "running",
                "ssh_access": {"host": "host1.example.com", "username": "user1"},
            },
            {
                "id": "instance-456",
                "status": "starting",
                "ssh_access": {"host": "host2.example.com", "username": "user2"},
            },
        ]
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


@pytest.fixture(autouse=True)
def reset_ssh_manager():
    """Reset SSHManager singleton state before each test."""
    # Store the original instance
    original_instance = SSHManager._instance
    original_ssh_client = SSHManager._ssh_client

    # Reset all attributes
    SSHManager._instance = None
    SSHManager._ssh_client = None
    SSHManager._connected = False
    SSHManager._host = None
    SSHManager._username = None
    SSHManager._last_error = None
    SSHManager._connection_time = None

    # Get a fresh instance
    SSHManager()

    # Run the test
    yield

    # After the test, restore original state
    SSHManager._instance = original_instance
    SSHManager._ssh_client = original_ssh_client


def test_remote_shell_success(provider):
    """Test successful remote shell command execution."""
    # Create a mock client and set up the singleton
    mock_client = Mock()
    ssh_manager._ssh_client = mock_client
    ssh_manager._connected = True
    ssh_manager._host = "test.host"
    ssh_manager._username = "testuser"

    with (
        patch.object(SSHManager, "is_connected", new_callable=PropertyMock, return_value=True),
        patch.object(
            ssh_manager, "execute", return_value="Command output: Hello from remote server"
        ),
    ):
        result = provider.remote_shell({"command": "echo 'Hello from remote server'"})
        assert "Command output: Hello from remote server" in result


def test_remote_shell_not_connected(provider, mock_instances_response):
    """Test remote shell when SSH is not connected."""
    # Reset connection state
    ssh_manager._connected = False
    ssh_manager._host = None
    ssh_manager._username = None

    with (
        patch.object(SSHManager, "is_connected", new_callable=PropertyMock, return_value=False),
        patch("requests.get", return_value=mock_instances_response),
    ):
        result = provider.remote_shell({"command": "ls"})
        assert "Error: No active SSH connection" in result
        assert "Please connect first using ssh_connect" in result
        assert "Instance instance-123: host=host1.example.com, username=user1" in result


def test_remote_shell_not_connected_no_instances(provider):
    """Test remote shell when SSH is not connected and no instances available."""
    # Reset connection state
    ssh_manager._connected = False
    ssh_manager._host = None
    ssh_manager._username = None

    mock_response = Mock()
    mock_response.json.return_value = {"instances": []}

    with (
        patch.object(SSHManager, "is_connected", new_callable=PropertyMock, return_value=False),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.remote_shell({"command": "ls"})
        assert "Error: No active SSH connection" in result
        assert "Please connect to a remote server first using ssh_connect" in result


def test_remote_shell_execution_error(provider):
    """Test remote shell when command execution fails."""
    # Set up the singleton for connected state
    ssh_manager._connected = True
    ssh_manager._host = "test.host"
    ssh_manager._username = "testuser"

    with (
        patch.object(SSHManager, "is_connected", new_callable=PropertyMock, return_value=True),
        patch.object(ssh_manager, "execute", return_value="Error: Command execution failed"),
    ):
        result = provider.remote_shell({"command": "invalid_command"})
        assert "Error: Command execution failed" in result


def test_remote_shell_ssh_status(provider):
    """Test remote shell with ssh_status command."""
    # Set up the singleton for connected state
    ssh_manager._connected = True
    ssh_manager._host = "test.host"
    ssh_manager._username = "testuser"
    ssh_manager._connection_time = datetime(2024, 3, 20, 12, 0, 0)

    with (
        patch.object(SSHManager, "is_connected", new_callable=PropertyMock, return_value=True),
        patch.object(
            ssh_manager,
            "get_connection_info",
            return_value="Connected to test.host as testuser since 2024-03-20 12:00:00",
        ),
    ):
        result = provider.remote_shell({"command": "ssh_status"})
        assert "Connected to test.host as testuser since 2024-03-20 12:00:00" in result


def test_remote_shell_missing_command(provider):
    """Test remote shell with missing command."""
    with pytest.raises(Exception) as exc_info:
        provider.remote_shell({})
    assert "Field required" in str(exc_info.value)


def test_remote_shell_empty_command(provider):
    """Test remote shell with empty command."""
    with pytest.raises(Exception) as exc_info:
        provider.remote_shell({"command": ""})
    assert "length" in str(exc_info.value).lower() or "at least" in str(exc_info.value).lower()
