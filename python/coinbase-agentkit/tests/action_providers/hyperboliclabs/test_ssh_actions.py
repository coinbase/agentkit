"""Tests for the SSH-related actions (ssh_connect and remote_shell)."""

from unittest.mock import patch, MagicMock

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import (
    SSHAccessSchema,
    RemoteShellSchema,
)

from .conftest import MOCK_SSH_HOST, MOCK_SSH_USERNAME


def test_ssh_connect_schema_valid():
    """Test that SSHAccessSchema is valid with required parameters."""
    schema = SSHAccessSchema(
        host=MOCK_SSH_HOST,
        username=MOCK_SSH_USERNAME,
    )
    assert isinstance(schema, SSHAccessSchema)
    assert schema.host == MOCK_SSH_HOST
    assert schema.username == MOCK_SSH_USERNAME


def test_ssh_connect_schema_invalid():
    """Test that SSHAccessSchema validation fails with missing parameters."""
    with pytest.raises(ValueError):
        SSHAccessSchema()


def test_remote_shell_schema_valid():
    """Test that RemoteShellSchema is valid with required parameters."""
    command = "ls -la"
    schema = RemoteShellSchema(command=command)
    assert isinstance(schema, RemoteShellSchema)
    assert schema.command == command


def test_remote_shell_schema_invalid():
    """Test that RemoteShellSchema validation fails with missing parameters."""
    with pytest.raises(ValueError):
        RemoteShellSchema()


def test_ssh_connect_success(hyperbolic_provider):
    """Test successful ssh_connect with valid parameters."""
    # Mock the ssh_manager.connect method
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect") as mock_connect:
        mock_connect.return_value = f"Successfully connected to {MOCK_SSH_HOST} as {MOCK_SSH_USERNAME}"

        # Call the action
        args = {
            "host": MOCK_SSH_HOST,
            "username": MOCK_SSH_USERNAME,
        }
        result = hyperbolic_provider.ssh_connect(args)

        # Verify the result
        assert f"Successfully connected to {MOCK_SSH_HOST}" in result
        assert MOCK_SSH_USERNAME in result

        # Verify the method call
        mock_connect.assert_called_once_with(
            host=MOCK_SSH_HOST,
            username=MOCK_SSH_USERNAME,
            password=None,
            private_key_path=None,
            port=22
        )


def test_ssh_connect_error(hyperbolic_provider):
    """Test error handling in ssh_connect."""
    # Mock the ssh_manager.connect method to raise an exception
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.connect") as mock_connect:
        error_message = "Authentication failed"
        mock_connect.side_effect = Exception(error_message)

        # Call the action
        args = {
            "host": MOCK_SSH_HOST,
            "username": MOCK_SSH_USERNAME,
        }
        result = hyperbolic_provider.ssh_connect(args)

        # Verify the result
        assert result == f"SSH Connection Error: {error_message}"


def test_remote_shell_success(hyperbolic_provider):
    """Test successful remote_shell with valid parameters."""
    # Mock the ssh_manager methods
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.is_connected", return_value=True), \
         patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.execute") as mock_execute:
        command = "ls -la"
        command_output = "total 12\ndrwxr-xr-x  2 user user 4096 Apr 1 12:00 .\ndrwxr-xr-x 10 user user 4096 Apr 1 12:00 .."
        mock_execute.return_value = command_output

        # Call the action
        args = {"command": command}
        result = hyperbolic_provider.remote_shell(args)

        # Verify the result
        assert result == command_output

        # Verify the method call
        mock_execute.assert_called_once_with(command)


def test_remote_shell_not_connected(hyperbolic_provider):
    """Test remote_shell when SSH is not connected."""
    # Mock the ssh_manager.is_connected property
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.is_connected", return_value=False):
        # Call the action
        args = {"command": "ls -la"}
        result = hyperbolic_provider.remote_shell(args)

        # Verify the result
        assert "Error: No active SSH connection" in result


def test_remote_shell_status_command(hyperbolic_provider):
    """Test remote_shell with the special ssh_status command."""
    # Mock the ssh_manager methods
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.get_connection_info") as mock_get_info:
        status_info = f"Connected to {MOCK_SSH_HOST} as {MOCK_SSH_USERNAME}"
        mock_get_info.return_value = status_info

        # Call the action
        args = {"command": "ssh_status"}
        result = hyperbolic_provider.remote_shell(args)

        # Verify the result
        assert result == status_info

        # Verify the method call
        mock_get_info.assert_called_once()


def test_remote_shell_error(hyperbolic_provider):
    """Test error handling in remote_shell."""
    # Mock the ssh_manager methods
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.is_connected", return_value=True), \
         patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.ssh_manager.execute") as mock_execute:
        error_message = "Command execution failed"
        mock_execute.side_effect = Exception(error_message)

        # Call the action
        args = {"command": "invalid_command"}
        result = hyperbolic_provider.remote_shell(args)

        # Verify the result
        assert result == f"Error executing remote command: {error_message}" 