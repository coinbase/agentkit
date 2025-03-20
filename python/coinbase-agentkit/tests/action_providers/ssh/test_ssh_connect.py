"""Tests for SSH connect action.

This module tests the ssh_connect action of the SshActionProvider, including
successful connections, validation, and error handling.
"""

import uuid
from unittest import mock

from coinbase_agentkit.action_providers.ssh.connection import (
    SSHConnectionError,
    SSHKeyError,
    UnknownHostKeyError,
)
from coinbase_agentkit.action_providers.ssh.ssh_action_provider import SshActionProvider


def test_ssh_connect_success(ssh_provider):
    """Test successful SSH connection."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_connection.params.host = "example.com"
    mock_connection.params.username = "testuser"
    mock_pool.create_connection.return_value = mock_connection

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "password": "testpass",
        }
    )

    assert "Successfully connected to" in result
    assert "Connection ID: test-conn" in result
    mock_pool.create_connection.assert_called_once()
    mock_connection.connect.assert_called_once_with()


def test_ssh_connect_with_auto_id(ssh_provider):
    """Test SSH connection with auto-generated ID."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_connection.params.host = "example.com"
    mock_connection.params.username = "testuser"
    mock_pool.create_connection.return_value = mock_connection

    mock_uuid = "mock-uuid-1234"
    with mock.patch.object(uuid, "uuid4", return_value=mock_uuid):
        result = ssh_provider.ssh_connect(
            {
                "host": "example.com",
                "username": "testuser",
                "password": "testpass",
            }
        )

    assert mock_uuid in result
    assert "Successfully connected to" in result
    mock_pool.create_connection.assert_called_once()
    mock_connection.connect.assert_called_once_with()


def test_ssh_connect_connection_error(ssh_provider):
    """Test SSH connection with connection error."""
    mock_pool = ssh_provider.connection_pool
    mock_pool.create_connection.side_effect = SSHConnectionError("Connection failed")

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "password": "testpass",
        }
    )

    assert "Error: Connection:" in result


def test_ssh_connect_validation_error():
    """Test SSH connection with validation error."""
    provider = SshActionProvider()

    result = provider.ssh_connect({"connection_id": "test-conn"})

    assert "Invalid input parameters" in result


def test_ssh_connect_with_private_key(ssh_provider):
    """Test SSH connection using private key authentication."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_connection.params.host = "example.com"
    mock_connection.params.username = "testuser"
    mock_pool.create_connection.return_value = mock_connection

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMockKeyContent\n-----END RSA PRIVATE KEY-----",
        }
    )

    assert "Successfully connected to" in result
    assert "Connection ID: test-conn" in result
    mock_pool.create_connection.assert_called_once()
    mock_connection.connect.assert_called_once_with()


def test_ssh_connect_with_key_path(ssh_provider):
    """Test SSH connection using private key file path."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_connection.params.host = "example.com"
    mock_connection.params.username = "testuser"
    mock_pool.create_connection.return_value = mock_connection

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "private_key_path": "~/.ssh/test_key",
        }
    )

    assert "Successfully connected to" in result
    assert "Connection ID: test-conn" in result
    mock_pool.create_connection.assert_called_once()
    mock_connection.connect.assert_called_once_with()


def test_ssh_connect_key_error(ssh_provider):
    """Test SSH connection with key file error."""
    mock_pool = ssh_provider.connection_pool
    mock_pool.create_connection.side_effect = SSHKeyError("Key file not found")

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "private_key_path": "~/.ssh/nonexistent_key",
        }
    )

    assert "Error: SSH key issue:" in result


def test_ssh_connect_with_custom_port(ssh_provider):
    """Test SSH connection using a custom port."""
    mock_pool = ssh_provider.connection_pool
    mock_connection = mock.Mock()
    mock_connection.params.host = "example.com"
    mock_connection.params.username = "testuser"
    mock_connection.params.port = 2222
    mock_pool.create_connection.return_value = mock_connection

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "password": "testpass",
            "port": 2222,
        }
    )

    assert "Successfully connected to" in result
    assert "Connection ID: test-conn" in result
    mock_pool.create_connection.assert_called_once()
    mock_connection.connect.assert_called_once_with()


def test_ssh_connect_unknown_host_key(ssh_provider):
    """Test handling of unknown host keys."""
    mock_pool = ssh_provider.connection_pool

    error_message = (
        "Host key verification failed for example.com. Server sent:\n"
        "  ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==\n\n"
        "To add this host key, use the ssh_add_host_key action with the following parameters:\n"
        "  host: example.com\n"
        "  key: AAAAB3NzaC1yc2EAAAADAQABAAABAQ==\n"
        "  key_type: ssh-rsa"
    )

    mock_pool.create_connection.side_effect = UnknownHostKeyError(error_message)

    result = ssh_provider.ssh_connect(
        {
            "connection_id": "test-conn",
            "host": "example.com",
            "username": "testuser",
            "password": "testpass",
        }
    )

    assert "Host key verification failed" in result
    assert "host: example.com" in result
    assert "key: AAAAB3NzaC1yc2EAAAADAQABAAABAQ==" in result
    assert "key_type: ssh-rsa" in result
