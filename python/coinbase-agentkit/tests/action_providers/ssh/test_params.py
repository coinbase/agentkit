"""Tests for SSH connection parameters.

This module tests the SSHConnectionParams model, including validation
and parameter handling.
"""

from coinbase_agentkit.action_providers.ssh.connection import SSHConnectionParams


def test_connection_params_with_password():
    """Test creating connection parameters with password authentication."""
    params = SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        password="testpass",
    )

    assert params.connection_id == "test-conn"
    assert params.host == "example.com"
    assert params.username == "testuser"
    assert params.password == "testpass"
    assert params.port == 22


def test_connection_params_with_private_key():
    """Test creating connection parameters with private key authentication."""
    params = SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        private_key="SSH_KEY_CONTENT",
    )

    assert params.connection_id == "test-conn"
    assert params.host == "example.com"
    assert params.username == "testuser"
    assert params.private_key == "SSH_KEY_CONTENT"
    assert params.password is None


def test_connection_params_with_key_path():
    """Test creating connection parameters with key path authentication."""
    params = SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        private_key_path="~/.ssh/id_rsa",
    )

    assert params.connection_id == "test-conn"
    assert params.host == "example.com"
    assert params.username == "testuser"
    assert params.private_key_path == "~/.ssh/id_rsa"


def test_connection_params_with_custom_port():
    """Test creating connection parameters with custom port."""
    params = SSHConnectionParams(
        connection_id="test-conn",
        host="example.com",
        username="testuser",
        password="testpass",
        port=2222,
    )

    assert params.port == 2222
