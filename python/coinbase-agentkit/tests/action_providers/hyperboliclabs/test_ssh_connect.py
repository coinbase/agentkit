"""Tests for ssh_connect action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


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


def test_ssh_connect_success_with_password(provider):
    """Test successful SSH connection using password authentication."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch(
            "coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect",
            return_value="Successfully connected to host.example.com as testuser",
        ),
    ):
        result = provider.ssh_connect(
            {"host": "host.example.com", "username": "testuser", "password": "testpass"}
        )
        assert "Successfully connected to host.example.com as testuser" in result


def test_ssh_connect_success_with_key(provider):
    """Test successful SSH connection using key authentication."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch(
            "coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect",
            return_value="Successfully connected to host.example.com as testuser",
        ),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "private_key_path": "~/.ssh/test_key",
            }
        )
        assert "Successfully connected to host.example.com as testuser" in result


def test_ssh_connect_missing_credentials(provider, mock_instances_response):
    """Test SSH connection with missing host/username."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_instances_response),
    ):
        # Empty host and username
        result = provider.ssh_connect({"host": "", "username": ""})
        assert "Missing host or username" in result
        assert "Instance instance-123: host=host1.example.com, username=user1" in result

        # Empty username
        result = provider.ssh_connect({"host": "host.example.com", "username": ""})
        assert "Missing host or username" in result

        # Empty host
        result = provider.ssh_connect({"host": "", "username": "testuser"})
        assert "Missing host or username" in result


def test_ssh_connect_connection_error(provider):
    """Test SSH connection with connection error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch(
            "coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect",
            side_effect=Exception("Connection refused"),
        ),
    ):
        result = provider.ssh_connect(
            {"host": "host.example.com", "username": "testuser", "password": "testpass"}
        )
        assert "SSH Connection Error: Connection refused" in result


def test_ssh_connect_key_error(provider):
    """Test SSH connection with key file error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch(
            "coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect",
            return_value="SSH Key Error: Key file not found at ~/.ssh/missing_key",
        ),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "private_key_path": "~/.ssh/missing_key",
            }
        )
        assert "SSH Key Error: Key file not found at ~/.ssh/missing_key" in result


def test_ssh_connect_custom_port(provider):
    """Test SSH connection with custom port."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch(
            "coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect",
            return_value="Successfully connected to host.example.com:2222 as testuser",
        ),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "password": "testpass",
                "port": 2222,
            }
        )
        assert "Successfully connected to host.example.com:2222 as testuser" in result


def test_ssh_connect_no_running_instances(provider):
    """Test SSH connection suggestion when no instances are running."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instances": [
            {
                "id": "instance-123",
                "status": "starting",
                "ssh_access": {"host": "host1.example.com", "username": "user1"},
            }
        ]
    }

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.ssh_connect({"host": "", "username": ""})
        assert "Error: Host and username are required for SSH connection." in result
