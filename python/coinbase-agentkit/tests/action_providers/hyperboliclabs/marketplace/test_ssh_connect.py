"""Tests for ssh_connect action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.utils import ssh_manager


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
    mock_response.status_code = 200
    return mock_response


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_ssh_connect_success_with_password(provider):
    """Test successful SSH connection using password authentication."""
    mock_response = "Successfully connected to host.example.com as testuser"

    with (
        patch.object(ssh_manager, "connect", return_value=mock_response),
    ):
        result = provider.ssh_connect(
            {"host": "host.example.com", "username": "testuser", "password": "testpass"}
        )
        assert "Successfully connected to host.example.com as testuser" in result
        ssh_manager.connect.assert_called_once_with(
            host="host.example.com",
            username="testuser",
            password="testpass",
            private_key_path=None,
            port=22,
        )


def test_ssh_connect_success_with_key(provider):
    """Test successful SSH connection using key authentication."""
    mock_response = "Successfully connected to host.example.com as testuser"

    with (
        patch.object(ssh_manager, "connect", return_value=mock_response),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "private_key_path": "~/.ssh/test_key",
            }
        )
        assert "Successfully connected to host.example.com as testuser" in result
        ssh_manager.connect.assert_called_once_with(
            host="host.example.com",
            username="testuser",
            password=None,
            private_key_path="~/.ssh/test_key",
            port=22,
        )


def test_ssh_connect_missing_credentials(provider, mock_instances_response):
    """Test SSH connection with missing host/username."""
    with (
        patch("requests.get", return_value=mock_instances_response),
    ):
        result = provider.ssh_connect({"host": "", "username": ""})
        assert "SSH Key Error: Key file not found at" in result


def test_ssh_connect_connection_error(provider):
    """Test SSH connection with connection error."""
    mock_error_response = "SSH Connection Error: Connection refused"

    with (
        patch.object(ssh_manager, "connect", return_value=mock_error_response),
    ):
        result = provider.ssh_connect(
            {"host": "host.example.com", "username": "testuser", "password": "testpass"}
        )
        assert "SSH Connection Error: Connection refused" in result
        ssh_manager.connect.assert_called_once_with(
            host="host.example.com",
            username="testuser",
            password="testpass",
            private_key_path=None,
            port=22,
        )


def test_ssh_connect_key_error(provider):
    """Test SSH connection with key file error."""
    mock_key_error = "SSH Key Error: Key file not found at ~/.ssh/test_key"

    with (
        patch.object(ssh_manager, "connect", return_value=mock_key_error),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "private_key_path": "~/.ssh/test_key",
            }
        )
        assert "SSH Key Error: Key file not found at" in result
        ssh_manager.connect.assert_called_once_with(
            host="host.example.com",
            username="testuser",
            password=None,
            private_key_path="~/.ssh/test_key",
            port=22,
        )


def test_ssh_connect_custom_port(provider):
    """Test SSH connection with custom port."""
    mock_response = "Successfully connected to host.example.com as testuser"

    with (
        patch.object(ssh_manager, "connect", return_value=mock_response),
    ):
        result = provider.ssh_connect(
            {
                "host": "host.example.com",
                "username": "testuser",
                "password": "testpass",
                "port": 2222,
            }
        )
        assert "Successfully connected to host.example.com as testuser" in result
        ssh_manager.connect.assert_called_once_with(
            host="host.example.com",
            username="testuser",
            password="testpass",
            private_key_path=None,
            port=2222,
        )


def test_ssh_connect_no_running_instances(provider):
    """Test SSH connection with no running instances."""
    mock_response = Mock()
    mock_response.json.return_value = {"instances": []}
    mock_response.status_code = 200

    with (
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.ssh_connect({"host": "", "username": ""})
        assert "SSH Key Error: Key file not found at" in result
