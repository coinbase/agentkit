"""Tests for remote_shell action in HyperbolicActionProvider."""

from datetime import datetime
from unittest.mock import Mock, PropertyMock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    HyperbolicMarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.utils import (
    SSHManager, ssh_manager
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace import utils
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.models import (
    RentedInstancesResponse,
    NodeRental,
    NodeInstance,
    HardwareInfo,
    SSHAccess,
)


@pytest.fixture
def mock_rented_instances_response():
    """Mock API response for rented instances."""
    instance1 = NodeInstance(
        id="instance-123",
        status="running",
        hardware=HardwareInfo(gpus=[]),
        gpu_count=1,
    )
    
    instance2 = NodeInstance(
        id="instance-456",
        status="starting",
        hardware=HardwareInfo(gpus=[]),
        gpu_count=1,
    )
    
    rental1 = NodeRental(
        id="i-123456",
        instance=instance1,
        ssh_access=SSHAccess(
            host="host1.example.com",
            username="user1",
        ),
    )
    
    rental2 = NodeRental(
        id="i-789012",
        instance=instance2,
        ssh_access=SSHAccess(
            host="host2.example.com",
            username="user2",
        ),
    )
    
    return RentedInstancesResponse(instances=[rental1, rental2])


@pytest.fixture
def provider():
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return HyperbolicMarketplaceActionProvider(api_key="test-api-key")


@pytest.fixture(autouse=True)
def reset_ssh_manager():
    """Reset SSHManager singleton state before each test."""
    # Store original state
    original_instance = SSHManager._instance
    original_ssh_client = SSHManager._ssh_client
    original_connected = SSHManager._connected
    
    # Reset all attributes
    SSHManager._instance = None
    SSHManager._ssh_client = None
    SSHManager._connected = False
    SSHManager._host = None
    SSHManager._username = None
    SSHManager._last_error = None
    SSHManager._connection_time = None
    
    # Force re-initialization of the singleton
    from importlib import reload
    reload(utils)
    
    yield
    
    # Restore original state
    SSHManager._instance = original_instance
    SSHManager._ssh_client = original_ssh_client
    SSHManager._connected = original_connected


def test_remote_shell_success(provider, mock_rented_instances_response):
    """Test successful remote shell command execution."""
    # Create a mock ssh manager
    mock_ssh = Mock()
    mock_ssh.is_connected = True
    mock_ssh.execute.return_value = "Command output: Hello from remote server"
    
    # Replace the real ssh_manager with our mock
    with patch('coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider.ssh_manager', mock_ssh):
        result = provider.remote_shell({"command": "echo 'Hello from remote server'"})
        assert result == "Command output: Hello from remote server"
        mock_ssh.execute.assert_called_once_with("echo 'Hello from remote server'")


def test_remote_shell_not_connected(provider, mock_rented_instances_response):
    """Test remote shell when SSH is not connected."""
    # Mock ssh_manager.is_connected to return False
    utils.ssh_manager._connected = False
    utils.ssh_manager._ssh_client = None
    
    # Patch get_rented_instances to return our mock response
    with patch.object(provider.marketplace, "get_rented_instances", return_value=mock_rented_instances_response):
        result = provider.remote_shell({"command": "ls"})
        assert "Error: No active SSH connection. Please connect first using ssh_connect." in result
        assert "Available instances:" in result
        assert "Instance i-123456: host=host1.example.com, username=user1" in result


def test_remote_shell_not_connected_no_instances(provider):
    """Test remote shell when SSH is not connected and no instances available."""
    # Mock ssh_manager.is_connected to return False
    utils.ssh_manager._connected = False
    utils.ssh_manager._ssh_client = None
    
    # Patch get_rented_instances to return empty list
    with patch.object(provider.marketplace, "get_rented_instances", return_value=RentedInstancesResponse(instances=[])):
        result = provider.remote_shell({"command": "ls"})
        assert result == "Error: No active SSH connection. Please connect to a remote server first using ssh_connect."


def test_remote_shell_execution_error(provider, mock_rented_instances_response):
    """Test remote shell when command execution fails."""
    error_msg = "Command failed: permission denied"
    
    # Create a mock ssh manager
    mock_ssh = Mock()
    mock_ssh.is_connected = True
    mock_ssh.execute.side_effect = Exception(error_msg)
    
    # Replace the real ssh_manager with our mock
    with patch('coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider.ssh_manager', mock_ssh):
        result = provider.remote_shell({"command": "invalid_command"})
        assert result == f"Error executing remote command: {error_msg}"
        mock_ssh.execute.assert_called_once_with("invalid_command")


def test_remote_shell_ssh_status(provider, mock_rented_instances_response):
    """Test remote shell with ssh_status command."""
    connection_info = "Connected to test.host as testuser since 2024-03-20 12:00:00"
    
    # Create a mock ssh manager
    mock_ssh = Mock()
    mock_ssh.is_connected = True
    mock_ssh.get_connection_info.return_value = connection_info
    
    # Replace the real ssh_manager with our mock
    with patch('coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider.ssh_manager', mock_ssh):
        result = provider.remote_shell({"command": "ssh_status"})
        assert result == connection_info
        mock_ssh.get_connection_info.assert_called_once()


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
